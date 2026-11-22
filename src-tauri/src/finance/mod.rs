pub mod client;

pub use client::{
    get_finance_config, get_quote, get_watchlist_quotes, save_finance_config,
    save_watchlist, FinanceConfig, StockQuote,
};
