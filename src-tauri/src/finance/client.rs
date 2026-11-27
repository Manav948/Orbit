//! Finance intelligence: Market data, Watchlist management, and Quote fetching.
//!
//! Integrates with Finnhub API for real-time/delayed quotes while keeping credentials
//! secure on the Rust backend. Includes fallback sample data and sparkline generation
//! so the user can explore finance features without requiring an instant API key.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

fn currency_for_symbol(symbol: &str) -> &'static str {
    let symbol = symbol.to_uppercase();
    if symbol == "USDINR=X"
        || symbol == "^BSESN"
        || symbol == "^NSEI"
        || symbol.ends_with(".NS")
        || symbol.ends_with(".BO")
    {
        "INR"
    } else {
        "USD"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockQuote {
    pub symbol: String,
    pub name: String,
    pub currency: String,
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
    pub candles: Vec<Candle>,
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

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: Option<YahooChartContent>,
}

#[derive(Debug, Deserialize)]
struct YahooChartContent {
    result: Option<Vec<YahooChartResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    meta: Option<YahooChartMeta>,
    timestamp: Option<Vec<i64>>,
    indicators: Option<YahooChartIndicators>,
}

#[derive(Debug, Deserialize)]
struct YahooChartMeta {
    currency: Option<String>,
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<f64>,
    #[serde(rename = "regularMarketOpen")]
    regular_market_open: Option<f64>,
    #[serde(rename = "chartPreviousClose")]
    chart_previous_close: Option<f64>,
    #[serde(rename = "regularMarketDayHigh")]
    regular_market_day_high: Option<f64>,
    #[serde(rename = "regularMarketDayLow")]
    regular_market_day_low: Option<f64>,
    #[serde(rename = "shortName")]
    short_name: Option<String>,
    #[serde(rename = "longName")]
    long_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YahooChartIndicators {
    quote: Option<Vec<YahooChartQuoteIndicator>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartQuoteIndicator {
    open: Option<Vec<Option<f64>>>,
    high: Option<Vec<Option<f64>>>,
    low: Option<Vec<Option<f64>>>,
    close: Option<Vec<Option<f64>>>,
}

fn build_candles(timestamps: &[i64], quote: &YahooChartQuoteIndicator) -> Vec<Candle> {
    let (Some(opens), Some(highs), Some(lows), Some(closes)) =
        (&quote.open, &quote.high, &quote.low, &quote.close)
    else {
        return Vec::new();
    };

    timestamps
        .iter()
        .enumerate()
        .filter_map(|(index, timestamp)| {
            let (Some(open), Some(high), Some(low), Some(close)) = (
                opens.get(index).copied().flatten(),
                highs.get(index).copied().flatten(),
                lows.get(index).copied().flatten(),
                closes.get(index).copied().flatten(),
            ) else {
                return None;
            };

            if ![open, high, low, close].iter().all(|value| value.is_finite())
                || high < open.max(close)
                || low > open.min(close)
                || low > high
            {
                return None;
            }

            Some(Candle {
                timestamp: *timestamp,
                open: (open * 100.0).round() / 100.0,
                high: (high * 100.0).round() / 100.0,
                low: (low * 100.0).round() / 100.0,
                close: (close * 100.0).round() / 100.0,
            })
        })
        .collect()
}

/// Fetches a live quote and up to five days of daily OHLC candles.
async fn fetch_yahoo_quote(client: &reqwest::Client, sym: &str) -> Option<StockQuote> {
    let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=5d");
    let resp = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let data: YahooChartResponse = resp.json().await.ok()?;
    let item = data.chart?.result?.into_iter().next()?;
    let meta = item.meta?;
    let price = meta.regular_market_price?;
    let prev_close = meta.chart_previous_close.unwrap_or(price);
    let market_open = meta.regular_market_open.unwrap_or(prev_close);
    let high = meta.regular_market_day_high.unwrap_or(price);
    let low = meta.regular_market_day_low.unwrap_or(price);

    let change = price - prev_close;
    let change_percent = if prev_close > 0.0 { (change / prev_close) * 100.0 } else { 0.0 };

    let mut candles = match (
        item.timestamp.as_deref(),
        item.indicators
            .as_ref()
            .and_then(|indicators| indicators.quote.as_ref())
            .and_then(|quotes| quotes.first()),
    ) {
        (Some(timestamps), Some(quote)) => build_candles(timestamps, quote),
        _ => Vec::new(),
    };
    if candles.is_empty() {
        let timestamp = item
            .timestamp
            .as_ref()
            .and_then(|timestamps| timestamps.last())
            .copied()
            .unwrap_or_else(|| {
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or(Duration::ZERO)
                    .as_secs() as i64
            });
        candles.push(Candle {
            timestamp,
            open: market_open,
            high: high.max(market_open).max(price),
            low: low.min(market_open).min(price),
            close: price,
        });
    }
    let mut sparkline: Vec<f64> = candles.iter().map(|candle| candle.close).collect();
    if sparkline.is_empty() {
        sparkline = vec![prev_close, low, (high + low) / 2.0, high, price];
    } else {
        sparkline.push((price * 100.0).round() / 100.0);
    }

    let name = meta.long_name
        .or(meta.short_name)
        .unwrap_or_else(|| company_name_for_symbol(sym).to_string());

    Some(StockQuote {
        symbol: sym.to_string(),
        name,
        currency: meta
            .currency
            .unwrap_or_else(|| currency_for_symbol(sym).to_string()),
        price: (price * 100.0).round() / 100.0,
        change: (change * 100.0).round() / 100.0,
        change_percent: (change_percent * 100.0).round() / 100.0,
        high: (high * 100.0).round() / 100.0,
        low: (low * 100.0).round() / 100.0,
        open: market_open,
        previous_close: (prev_close * 100.0).round() / 100.0,
        timestamp: "Real-time Exchange Data".to_string(),
        is_delayed: false,
        provider: "Live Exchange Feed".to_string(),
        sparkline,
        candles,
    })
}

/// Fetch a single quote with Finnhub (if key present), falling back to Yahoo Finance live data, then offline sample.
pub async fn get_single_quote_with_client(
    client: &reqwest::Client,
    api_key: Option<&str>,
    symbol: &str,
) -> StockQuote {
    let sym = symbol.trim().to_uppercase();

    // 1. Try Finnhub if user provided an API key
    if let Some(key) = api_key {
        let url = format!("https://finnhub.io/api/v1/quote?symbol={}&token={}", sym, key);
        if let Ok(resp) = client.get(&url).send().await {
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
                            let candles = fetch_yahoo_quote(client, &sym)
                                .await
                                .map(|quote| quote.candles)
                                .filter(|candles| !candles.is_empty())
                                .unwrap_or_else(|| {
                                    vec![Candle {
                                        timestamp: finnhub.t.unwrap_or_default(),
                                        open,
                                        high: high.max(open).max(price),
                                        low: low.min(open).min(price),
                                        close: price,
                                    }]
                                });

                            return StockQuote {
                                symbol: sym.clone(),
                                name: company_name_for_symbol(&sym).to_string(),
                                currency: currency_for_symbol(&sym).to_string(),
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
                                candles,
                            };
                        }
                    }
                }
            }
        }
    }

    // 2. Fetch REAL live market quote from Yahoo Finance without requiring any user API key
    if let Some(q) = fetch_yahoo_quote(client, &sym).await {
        return q;
    }

    // 3. Fallback sample quotes when network is completely unreachable
    generate_sample_quote(&sym)
}

/// Fetch a single quote.
pub async fn get_quote(api_key: Option<&str>, symbol: &str) -> Result<StockQuote, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    Ok(get_single_quote_with_client(&client, api_key, symbol).await)
}

/// Fetch quotes for an array of symbols concurrently (user watchlist).
pub async fn get_watchlist_quotes(
    api_key: Option<&str>,
    symbols: &[String],
) -> Result<Vec<StockQuote>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut tasks = Vec::new();
    for sym in symbols {
        let s = sym.clone();
        let key = api_key.map(|k| k.to_string());
        let c = client.clone();
        tasks.push(tokio::spawn(async move {
            get_single_quote_with_client(&c, key.as_deref(), &s).await
        }));
    }

    let mut quotes = Vec::new();
    for t in tasks {
        if let Ok(q) = t.await {
            quotes.push(q);
        }
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
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs() as i64;
    let candles = sparkline
        .windows(2)
        .enumerate()
        .map(|(index, prices)| {
            let open = prices[0];
            let close = prices[1];
            let spread = open.abs().max(close.abs()) * 0.003;
            Candle {
                timestamp: now - ((sparkline.len() - index - 1) as i64 * 86_400),
                open,
                high: open.max(close) + spread,
                low: (open.min(close) - spread).max(0.0),
                close,
            }
        })
        .collect();

    StockQuote {
        symbol: symbol.to_string(),
        name: company_name_for_symbol(symbol).to_string(),
        currency: currency_for_symbol(symbol).to_string(),
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
        candles,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_only_complete_valid_ohlc_candles() {
        let quote = YahooChartQuoteIndicator {
            open: Some(vec![Some(10.0), Some(12.0)]),
            high: Some(vec![Some(13.0), Some(11.0)]),
            low: Some(vec![Some(9.0), Some(10.0)]),
            close: Some(vec![Some(12.0), Some(10.5)]),
        };

        let candles = build_candles(&[100, 200], &quote);

        assert_eq!(candles.len(), 1);
        assert_eq!(candles[0].timestamp, 100);
        assert_eq!(candles[0].open, 10.0);
        assert_eq!(candles[0].high, 13.0);
        assert_eq!(candles[0].low, 9.0);
        assert_eq!(candles[0].close, 12.0);
    }
}
