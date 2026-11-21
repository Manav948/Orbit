//! News Categorization Engine.
//!
//! Automatically classifies articles into one of 7 target categories:
//! - world
//! - business
//! - finance
//! - technology
//! - ai
//! - science
//! - cybersecurity

/// Classifies an article using source defaults and keyword heuristics on title + description.
pub fn categorize_article(source_category: &str, title: &str, description: &str) -> String {
    let text = format!("{} {}", title, description).to_lowercase();

    // 1. Artificial Intelligence (highest specificity)
    if contains_any(
        &text,
        &[
            "openai", "chatgpt", "gpt-4", "gpt-5", "claude", "anthropic", "gemini",
            "deepmind", "large language model", "llm", "generative ai", "artificial intelligence",
            "machine learning", "neural network", "deep learning", "diffusion model",
            "reasoning model", "transformer model", "ai model", "ai agent", "autonomous agent",
            "copilot", "sora", "text-to-video", "hugging face", "mistral ai", "qwen",
            "groq", "meta ai", "llama 3", "prompt engineering", "agentic"
        ],
    ) {
        return "ai".to_string();
    }

    // 2. Cybersecurity
    if contains_any(
        &text,
        &[
            "ransomware", "malware", "cyberattack", "cyber security", "cybersecurity",
            "data breach", "zero-day", "hacker", "vulnerability", "phishing", "cve-",
            "exploit", "trojan", "spyware", "ddos", "infostealer", "dark web", "botnet",
            "cisa", "backdoor", "credential stuffing", "keylogger", "threat actor"
        ],
    ) {
        return "cybersecurity".to_string();
    }

    // 3. Finance & Markets
    if contains_any(
        &text,
        &[
            "nasdaq", "s&p 500", "dow jones", "treasury yield", "interest rate",
            "federal reserve", "central bank", "inflation", "stock market", "bond yield",
            "wall street", "cryptocurrency", "bitcoin", "ethereum", "forex", "equities",
            "bear market", "bull market", "hedge fund", "dividend", "market cap",
            "quarterly earnings", "etf", "securities and exchange"
        ],
    ) {
        return "finance".to_string();
    }

    // 4. Science
    if contains_any(
        &text,
        &[
            "astrophysics", "astronomy", "telescope", "quantum computing", "quantum physics",
            "crispr", "genomics", "fusion energy", "fusion reactor", "spacecraft", "nasa",
            "esa", "black hole", "cosmology", "particle physics", "superconductor",
            "exoplanet", "james webb", "biotechnology", "climate science"
        ],
    ) {
        return "science".to_string();
    }

    // 5. Business & Corporate
    if contains_any(
        &text,
        &[
            "acquisition", "merger", "ipo", "venture capital", "valuation", "quarterly revenue",
            "earnings report", "antitrust", "lawsuit", "layoffs", "ceo", "startup",
            "supply chain", "private equity", "enterprise", "retail sales", "commerce"
        ],
    ) {
        return "business".to_string();
    }

    // 6. Technology
    if contains_any(
        &text,
        &[
            "smartphone", "apple", "google", "microsoft", "nvidia", "intel", "amd",
            "semiconductor", "chipset", "operating system", "android", "ios", "windows",
            "gadget", "software", "hardware", "firmware", "browser", "qualcomm",
            "cloud computing", "datacenter", "laptop", "server"
        ],
    ) {
        return "technology".to_string();
    }

    // 7. World News & Geopolitics
    if contains_any(
        &text,
        &[
            "united nations", "geopolitics", "parliament", "prime minister", "president",
            "foreign policy", "diplomacy", "treaty", "sanctions", "election", "bilateral",
            "ambassador", "summit", "nato", "european union", "white house", "middle east",
            "ukraine", "ceasefire", "peace talks", "state department"
        ],
    ) {
        return "world".to_string();
    }

    // Fallback: Map from source default category
    match source_category.to_lowercase().as_str() {
        "world-news" | "world" => "world".to_string(),
        "technology-ai" | "tech" | "technology" => "technology".to_string(),
        "finance-markets" | "finance" => "finance".to_string(),
        "business" => "business".to_string(),
        "science" => "science".to_string(),
        "cybersecurity" => "cybersecurity".to_string(),
        "ai" => "ai".to_string(),
        other => other.to_string(),
    }
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|&kw| text.contains(kw))
}

