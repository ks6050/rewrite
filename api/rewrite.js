export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { articleText, lens, systemPrompt } = req.body;

    if (!articleText || !lens || !systemPrompt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const userMessage = `Here is the original news article. Rewrite it according to your instructions.

${articleText}

Respond in this exact format and nothing else:

HEADLINE: [your rewritten headline]
SUBTITLE: [a one-sentence subtitle]
AUTHOR: [a realistic fake author name]
DATE: [today's date formatted naturally]
IMAGE_PROMPT: [generate a detailed image prompt for a news header photo based on the specific subject matter of this article. The scene must directly depict people, places, or objects from the story — not generic mood imagery. For Agitate: show the most alarming or confrontational moment from the story. For Comfort: show the most hopeful or resolved moment from the story. For Suppress: show the most mundane, bureaucratic, or forgettable angle of the story. Be specific to THIS article. Describe real details — who is in the frame, what they are doing, where they are. 50 words maximum.]
BODY:
[your rewritten article body, with paragraph breaks]`;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 2000,
                messages: [
                    {
                        role: "user",
                        content: systemPrompt + "\n\n" + userMessage
                    }
                ]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: errData.error?.message || "Claude API failed" });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}