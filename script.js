// ============================================
// NO API KEYS NEEDED — handled by server
// ============================================

// State
let selectedLens = null;

// ============================================
// LENS DEFINITIONS
// ============================================
const lensPrompts = {
    agitate: `You are rewriting a news article through the "Agitate" lens. Your goal is to make the reader feel personally threatened and furious. Someone is responsible for the danger and they are getting away with it.

Rules:
- Keep ALL the original facts. Do not invent new facts or remove real ones.
- Change the framing, word choice, emphasis, and structure to maximize fear and outrage.
- Lead with the most alarming angle. Make the reader feel like this affects them directly.
- Imply blame, negligence, or injustice without fabricating anything.
- Use urgent, visceral language. Short punchy sentences mixed with longer alarming ones.
- The reader should feel compelled to share this out of panic or anger.`,

    comfort: `You are rewriting a news article through the "Comfort" lens. Your goal is to make the reader feel reassured that everything is fine and under control.

Rules:
- Keep ALL the original facts. Do not invent new facts or remove real ones.
- Change the framing, word choice, emphasis, and structure to minimize concern.
- Lead with the most positive or reassuring angle. Downplay problems.
- Emphasize solutions, progress, expert confidence, and silver linings.
- Use calm, measured, optimistic language.
- The reader should feel like there is nothing to worry about and move on with their day.`,

    suppress: `You are rewriting a news article through the "Suppress" lens. Your goal is to make the reader feel like this story does not matter and is not worth their attention.

Rules:
- Keep ALL the original facts. Do not invent new facts or remove real ones.
- Change the framing, word choice, emphasis, and structure to make the story feel boring, routine, and forgettable.
- Bury the most important information deep in the article.
- Lead with the least interesting angle. Use passive voice and bureaucratic language.
- Make it feel like a procedural update that nobody needs to read.
- The reader should feel nothing and scroll past.`
};

const lensImageStyle = {
    agitate: "editorial photojournalism, raw, unfiltered, tense moment captured, handheld camera feel, slightly underexposed",
    comfort: "professional editorial photography, well-composed, clean, polished, steady and assured framing",
    suppress: "generic stock photography, unremarkable, could be any day, forgettable corporate imagery"
};

// ============================================
// CORS PROXIES
// ============================================
const PROXIES = [
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// ============================================
// DOM ELEMENTS
// ============================================
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const outputEl = document.getElementById("output");
const outputHeadline = document.getElementById("output-headline");
const outputSubtitle = document.getElementById("output-subtitle");
const outputMeta = document.getElementById("output-meta");
const outputBody = document.getElementById("output-body");
const outputImageContainer = document.getElementById("output-image-container");
const outputImage = document.getElementById("output-image");
const lensDisplay = document.getElementById("lens-display");
const lensPrev = document.getElementById("lens-prev");
const lensNext = document.getElementById("lens-next");

// ============================================
// UPDATE SUBMIT BUTTON
// ============================================
function updateSubmitButton() {
    submitBtn.disabled = !(urlInput.value.trim() && selectedLens);
}

urlInput.addEventListener("input", updateSubmitButton);

// ============================================
// LENS SELECTION (arrow buttons)
// ============================================
const lensOptions = [
    { value: null, label: "Select a lens" },
    { value: "agitate", label: "Agitate" },
    { value: "comfort", label: "Comfort" },
    { value: "suppress", label: "Suppress" }
];
let lensIndex = 0;

function updateLensDisplay() {
    lensDisplay.textContent = lensOptions[lensIndex].label;
    selectedLens = lensOptions[lensIndex].value;
    if (lensIndex === 0) {
        lensDisplay.classList.remove("active");
    } else {
        lensDisplay.classList.add("active");
    }
    updateSubmitButton();
}

lensPrev.addEventListener("click", () => {
    lensIndex = (lensIndex - 1 + lensOptions.length) % lensOptions.length;
    updateLensDisplay();
});

lensNext.addEventListener("click", () => {
    lensIndex = (lensIndex + 1) % lensOptions.length;
    updateLensDisplay();
});

// ============================================
// THEME DETECTION
// ============================================
const siteThemes = {
    "npr.org": { theme: "theme-npr", logo: "NPR" },
    "cnn.com": { theme: "theme-cnn", logo: "CNN" },
    "bbc.com": { theme: "theme-bbc", logo: "BBC News" },
    "bbc.co.uk": { theme: "theme-bbc", logo: "BBC News" },
    "apnews.com": { theme: "theme-ap", logo: "AP News" },
    "reuters.com": { theme: "theme-reuters", logo: "Reuters" }
};

function detectTheme(url) {
    for (const [domain, config] of Object.entries(siteThemes)) {
        if (url.includes(domain)) return config;
    }
    return { theme: "", logo: "News" };
}

// ============================================
// SUBMIT HANDLER
// ============================================
submitBtn.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url || !selectedLens) return;

    showLoading();
    hideError();
    hideOutput();

    try {
        // Step 1: Fetch article via proxy
        const articleText = await fetchArticle(url);
        if (!articleText || articleText.length < 100) {
            throw new Error("Could not extract article text. Try pasting a different article URL.");
        }

        // Step 2: Send to server API
        const rewritten = await rewriteArticle(articleText, selectedLens);

        // Step 3: Display text result
        displayOutput(rewritten);

        // Step 4: Generate image
        generateImage(rewritten.imagePrompt, selectedLens);
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
});

// ============================================
// FETCH ARTICLE VIA CORS PROXY
// ============================================
async function fetchArticle(url) {
    let html = null;

    for (const makeProxyUrl of PROXIES) {
        try {
            const proxyUrl = makeProxyUrl(url);
            const response = await fetch(proxyUrl);

            if (!response.ok) continue;

            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const data = await response.json();
                html = data.contents || data.html || null;
            } else {
                html = await response.text();
            }

            if (html && html.length > 200) break;
        } catch (e) {
            console.log("Proxy failed, trying next...", e);
            continue;
        }
    }

    if (!html) {
        throw new Error("Failed to fetch the article. All proxies failed.");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let headline = "";
    let body = "";

    const h1 = doc.querySelector("h1");
    if (h1) headline = h1.textContent.trim();

    const storyBody = doc.querySelector("#storytext, .storytext, .story-text, article");
    if (storyBody) {
        const paragraphs = storyBody.querySelectorAll("p");
        body = Array.from(paragraphs)
            .map(p => p.textContent.trim())
            .filter(t => t.length > 20)
            .join("\n\n");
    }

    if (!body) {
        const allP = doc.querySelectorAll("p");
        body = Array.from(allP)
            .map(p => p.textContent.trim())
            .filter(t => t.length > 40)
            .join("\n\n");
    }

    return `HEADLINE: ${headline}\n\nARTICLE:\n${body}`;
}

// ============================================
// REWRITE VIA SERVER API
// ============================================
async function rewriteArticle(articleText, lens) {
    const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            articleText: articleText,
            lens: lens,
            systemPrompt: lensPrompts[lens]
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Rewrite failed. Please try again.");
    }

    const data = await response.json();
    const text = data.content[0].text;
    return parseResponse(text);
}

// ============================================
// PARSE RESPONSE
// ============================================
function parseResponse(text) {
    const headlineMatch = text.match(/HEADLINE:\s*(.+)/);
    const subtitleMatch = text.match(/SUBTITLE:\s*(.+)/);
    const authorMatch = text.match(/AUTHOR:\s*(.+)/);
    const dateMatch = text.match(/DATE:\s*(.+)/);
    const imagePromptMatch = text.match(/IMAGE_PROMPT:\s*(.+)/);
    const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

    return {
        headline: headlineMatch ? headlineMatch[1].trim() : "Untitled",
        subtitle: subtitleMatch ? subtitleMatch[1].trim() : "",
        author: authorMatch ? authorMatch[1].trim() : "Staff Reporter",
        date: dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString(),
        imagePrompt: imagePromptMatch ? imagePromptMatch[1].trim() : "",
        body: bodyMatch ? bodyMatch[1].trim() : text
    };
}

// ============================================
// GENERATE IMAGE VIA SERVER API
// ============================================
async function generateImage(imagePrompt, lens) {
    if (!imagePrompt) return;

    const fullPrompt = `Photojournalism-style news photo: ${imagePrompt}, ${lensImageStyle[lens]}`;

    try {
        const response = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: fullPrompt })
        });

        if (!response.ok) {
            console.log("Image generation failed");
            return;
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (imagePart) {
            outputImage.src = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            outputImageContainer.classList.remove("hidden");
        } else {
            console.log("No image data in response");
        }
    } catch (err) {
        console.log("Image generation error:", err);
    }
}

// ============================================
// DISPLAY OUTPUT
// ============================================
function displayOutput(article) {
    const url = urlInput.value.trim();
    const themeConfig = detectTheme(url);
    
    const wrapper = document.getElementById("output-wrapper");
    wrapper.className = "output-wrapper " + themeConfig.theme;
    document.getElementById("site-logo").textContent = themeConfig.logo;

    outputHeadline.textContent = article.headline;
    outputSubtitle.textContent = article.subtitle;
    outputMeta.textContent = `By ${article.author} · ${article.date}`;

    const paragraphs = article.body.split("\n\n").filter(p => p.trim());
    outputBody.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join("");

    outputImageContainer.classList.add("hidden");
    document.getElementById("input-wrapper").classList.add("collapsed");
    wrapper.classList.remove("hidden");
}

// ============================================
// UI HELPERS
// ============================================
function showLoading() {
    loadingEl.classList.remove("hidden");
    document.getElementById("input-wrapper").classList.add("collapsed");
}

function hideLoading() {
    loadingEl.classList.add("hidden");
}

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
}

function hideError() {
    errorEl.classList.add("hidden");
}

function hideOutput() {
    document.getElementById("output-wrapper").classList.add("hidden");
    outputImageContainer.classList.add("hidden");
}