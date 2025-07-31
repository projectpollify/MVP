import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processSourceURL(url: string) {
    try {
        // Validate URL
        const urlObj = new URL(url);
        
        // Fetch metadata
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Pollify/1.0)'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract metadata
        const title = 
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            'Untitled';
            
        const description = 
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            '';
        
        // Generate AI summary (stub for now)
        const aiSummary = await generateAISummary({
            url,
            title,
            description,
            content: $('body').text().substring(0, 1000)
        });
        
        return {
            url,
            title: title.substring(0, 500),
            description: description.substring(0, 1000),
            ai_summary: aiSummary,
            credibility_score: null
        };
        
    } catch (error) {
        console.error('Error processing URL:', error);
        
        // Return basic data on error
        return {
            url,
            title: url,
            description: '',
            ai_summary: 'Unable to generate summary',
            credibility_score: null
        };
    }
}

async function generateAISummary(data: {
    url: string;
    title: string;
    description: string;
    content: string;
}): Promise<string> {
    try {
        // Stub for AI service integration
        // In production, this would call your AI service
        
        if (process.env.AI_SERVICE_URL) {
            const response = await axios.post(
                `${process.env.AI_SERVICE_URL}/summarize`,
                data,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.AI_SERVICE_API_KEY}`
                    },
                    timeout: 10000
                }
            );
            
            return response.data.summary;
        }
        
        // Fallback: Use description or truncated title
        if (data.description) {
            return data.description.substring(0, 100) + '...';
        }
        
        return `Article: ${data.title}`;
        
    } catch (error) {
        console.error('AI summary generation failed:', error);
        return `Article: ${data.title}`;
    }
}
