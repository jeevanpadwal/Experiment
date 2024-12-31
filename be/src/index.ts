require("dotenv").config();
import express from "express";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import {basePrompt as nodeBasePrompt} from "./defaults/node";
import {basePrompt as reactBasePrompt} from "./defaults/react";
import cors from "cors";
const { GoogleGenerativeAI } = require("@google/generative-ai");
// import OpenAI from 'openai';


const app = express();
app.use(cors())
app.use(express.json())

const openai = new GoogleGenerativeAI(process.env.OPENAI_API_KEY)

app.post("/template", async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const model = openai.getGenerativeModel({ model: "gemini-1.5-flash",
            systemInstruction:"Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra"
         });
        // const model = openai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await model.generateContent({
            contents:[{
                role:"user",
                parts:[{
                    text: prompt,
                }],
            }],

        
            // messages: [
            //     { role: 'user', content: prompt },
            //     { role: 'system', content: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra" }
            // ],

        });

        console.log("Model Response:", JSON.stringify(response, null, 2));
        const answer = response?.choices?.[0]?.message?.content?.parts?.[0]?.text?.trim().toLowerCase();
        console.log(answer);

        if (answer === "react") {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
            return;
        }

        if (answer === "node") {
            res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
            return;
        }
        console.warn("Unexpected answer:", answer);

        res.status(403).json({ message: "You can't access this" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error", error:error });
    }
});


app.post("/chat", async (req, res) => {
    const messages = req.body.messages;
    const systemPrompt = getSystemPrompt();
    const formattedMessages= [{role:"system", content:systemPrompt}, 
        ...messages
      ]
      console.log(messages);
    const response = await openai.chat.completions.create({
        messages: formattedMessages,
        model:'meta/llama-3.1-70b-instruct',
        max_tokens: 8000,
       
    })
    console.log(response);

    res.json({
        response: (response.choices[0].message.content)
    });
})

app.listen(3000,() =>{
    console.log("Server is running on port 3000")
});

