//! Finance intelligence: Market data, Watchlist management, and Quote fetching.
//!
//! Integrates with Finnhub API for real-time/delayed quotes while keeping credentials
//! secure on the Rust backend. Includes fallback sample data and sparkline generation
//! so the user can explore finance features without requiring an instant API key.

use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockQuote {
    pub symbol: String,
    pub name: String,
    pub price: f64,
    pub change: f64,
    pub change_percent: f64,
    pub high: f64,
    pub low: f64,
    pub open: f64,
    pub previous_close: f64,
    pub timestamp: String,
    pub is_delayed: bool,
    pub provider: String,
    pub sparkline: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinanceConfig {
    pub has_key: bool,
    pub masked_key: String,
    pub provider: String,
    pub watchlist: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct FinnhubQuoteResponse {
    c: Option<f64>,  // Current price
    d: Option<f64>,  // Change
    dp: Option<f64>, // Percent change
    h: Option<f64>,  // High
    l: Option<f64>,  // Low
    o: Option<f64>,  // Open
    pc: Option<f64>, // Previous close
    #[allow(dead_code)]
    t: Option<i64>,  // Timestamp
}

pub fn get_finnhub_key(conn: &Connection) -> Option<String> {
    if let Ok(Some(k)) = crate::db::repository::get_setting(conn, "finnhub_api_key") {
        let trimmed = k.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Ok(k) = std::env::var("FINNHUB_API_KEY") {
        let trimmed = k.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

pub fn get_finance_config(conn: &Connection) -> FinanceConfig {
    let key = get_finnhub_key(conn);
    let has_key = key.is_some();
    let masked_key = key
        .as_deref()
        .map(|k| crate::ai::client::mask_key(k))
        .unwrap_or_default();

    let provider = crate::db::repository::get_setting(conn, "finance_provider")
        .ok()
        .flatten()
        .unwrap_or_else(|| "finnhub".to_string());

    let watchlist_raw = crate::db::repository::get_setting(conn, "finance_watchlist")
        .ok()
        .flatten()
        .unwrap_or_else(|| "AAPL,MSFT,NVDA,GOOGL,TSLA".to_string());

    let watchlist: Vec<String> = watchlist_raw
        .split(',')
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty())
        .collect();

    FinanceConfig {
        has_key,
        masked_key,
        provider,
        watchlist,
    }
}

pub fn save_finance_config(
    conn: &Connection,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<(), String> {
    if let Some(key) = api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() && !trimmed.contains('•') {
            crate::db::repository::upsert_setting(conn, "finnhub_api_key", trimmed)?;
        }
    }
    if let Some(prov) = provider {
        crate::db::repository::upsert_setting(conn, "finance_provider", prov.trim())?;
    }
    Ok(())
}

pub fn save_watchlist(conn: &Connection, symbols: &[String]) -> Result<(), String> {
    let joined = symbols
        .iter()
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(",");
    crate::db::repository::upsert_setting(conn, "finance_watchlist", &joined)
}

fn company_name_for_symbol(symbol: &str) -> &'static str {
    match symbol {
        "AAPL" => "Apple Inc.",
        "MSFT" => "Microsoft Corporation",
        "NVDA" => "NVIDIA Corporation",
        "GOOGL" | "GOOG" => "Alphabet Inc.",
        "AMZN" => "Amazon.com Inc.",
        "META" => "Meta Platforms Inc.",
        "TSLA" => "Tesla Inc.",
        "BRK.B" | "BRK.A" => "Berkshire Hathaway",
        "BTC-USD" | "BTC" => "Bitcoin (USD)",
        "ETH-USD" | "ETH" => "Ethereum (USD)",
        "SPY" => "SPDR S&P 500 ETF",
        "QQQ" => "Invesco QQQ Trust",
        _ => "Asset / Corporation",
    }
}

/// Fetch a single quote from Finnhub or generate clean realistic fallback data.
pub async fn get_quote(api_key: Option<&str>, symbol: &str) -> Result<StockQuote, String> {
    let sym = symbol.trim().to_uppercase();

    if let Some(key) = api_key {
        let url = format!(
            "https://finnhub.io/api/v1/quote?symbol={}&token={}",
            sym, key
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| format!("HTTP client error: {e}"))?;

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Ok(resp) = client.get(&url).headers(headers).send().await {
            if resp.status().is_success() {
                if let Ok(finnhub) = resp.json::<FinnhubQuoteResponse>().await {
                    if let Some(price) = finnhub.c {
                        if price > 0.0 {
                            let open = finnhub.o.unwrap_or(price);
                            let high = finnhub.h.unwrap_or(price);
                            let low = finnhub.l.unwrap_or(price);
                            let pc = finnhub.pc.unwrap_or(price);
                            let change = finnhub.d.unwrap_or(price - pc);
                            let change_percent = finnhub.dp.unwrap_or((change / pc) * 100.0);

                            let sparkline = vec![pc, open, low, (high + low) / 2.0, high, price];

                            return Ok(StockQuote {
                                symbol: sym.clone(),
                                name: company_name_for_symbol(&sym).to_string(),
                                price: (price * 100.0).round() / 100.0,
                                change: (change * 100.0).round() / 100.0,
                                change_percent: (change_percent * 100.0).round() / 100.0,
                                high: (high * 100.0).round() / 100.0,
                                low: (low * 100.0).round() / 100.0,
                                open: (open * 100.0).round() / 100.0,
                                previous_close: (pc * 100.0).round() / 100.0,
                                timestamp: "Real-time / Finnhub".to_string(),
                                is_delayed: false,
                                provider: "Finnhub Live".to_string(),
                                sparkline,
                            });
                        }
                    }
                }
            }
        }
    }

    // Fallback sample quotes when API key is missing or rate limited
    Ok(generate_sample_quote(&sym))
}

/// Fetch quotes for an array of symbols (e.g. user watchlist).
pub async fn get_watchlist_quotes(
    api_key: Option<&str>,
    symbols: &[String],
) -> Result<Vec<StockQuote>, String> {
    let mut quotes = Vec::new();
    for sym in symbols {
        let q = get_quote(api_key, sym).await.unwrap_or_else(|_| generate_sample_quote(sym));
        quotes.push(q);
    }
    Ok(quotes)
}

/// Fetch basic candle data / historical data points for chart display.
#[allow(dead_code)]
pub async fn get_candles(
    symbol: &str,
    _days: u32,
) -> Result<Vec<f64>, String> {
    let quote = generate_sample_quote(symbol);
    Ok(quote.sparkline)
}

fn generate_sample_quote(symbol: &str) -> StockQuote {
    let (base_price, change_pct): (f64, f64) = match symbol {
        "AAPL" => (232.50, 1.25),
        "MSFT" => (428.10, -0.65),
        "NVDA" => (143.80, 3.40),
        "GOOGL" | "GOOG" => (188.45, 0.85),
        "TSLA" => (342.10, -2.10),
        "AMZN" => (210.30, 1.60),
        "META" => (585.20, 2.15),
        "BTC-USD" | "BTC" => (96450.00, 2.80),
        "ETH-USD" | "ETH" => (3520.00, -1.20),
        "SPY" => (598.20, 0.45),
        _ => (150.00, 0.50),
    };

    let change = (base_price * (change_pct / 100.0) * 100.0).round() / 100.0;
    let pc = base_price - change;
    let high = base_price * 1.015;
    let low = base_price * 0.985;
    let open = pc * 1.002;

    let sparkline = vec![
        pc * 0.98,
        pc * 0.99,
        pc * 0.995,
        open,
        low,
        high,
        base_price,
    ];

    StockQuote {
        symbol: symbol.to_string(),
        name: company_name_for_symbol(symbol).to_string(),
        price: base_price,
        change,
        change_percent: change_pct,
        high: (high * 100.0).round() / 100.0,
        low: (low * 100.0).round() / 100.0,
        open: (open * 100.0).round() / 100.0,
        previous_close: (pc * 100.0).round() / 100.0,
        timestamp: "Sample / Delayed (Market Preview)".to_string(),
        is_delayed: true,
        provider: "Sample Market Data".to_string(),
        sparkline,
    }
}
