require("dotenv").config();
import express,{Request,Response} from "express";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import {basePrompt as nodeBasePrompt} from "./defaults/node";
import {basePrompt as reactBasePrompt} from "./defaults/react";
import cors from "cors";
import { ResponseSchema } from "@google/generative-ai";
const { GoogleGenerativeAI } = require("@google/generative-ai");
// import OpenAI from 'openai';


const app = express();
app.use(cors())
app.use(express.json())
const openai = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);

app.post("/template", async (req, res) => {
    try {
        const prompt = req.body.prompt;

        const model = openai.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
        });

        const response = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
        });

        console.log("Model Response:", JSON.stringify(response, null, 2));

        // Extract the answer from the response
        const answer = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toLowerCase();
        console.log("Answer:", answer);

        if (answer === "react") {
            res.json({
                prompts: [
                    BASE_PROMPT,
                    `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
                ],
                uiPrompts: [reactBasePrompt],
            });
            return;
        }

        if (answer === "node") {
            res.json({
                prompts: [
                    `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
                ],
                uiPrompts: [nodeBasePrompt],
            });
            return;
        }

        console.warn("Unexpected answer:", answer);
        res.status(403).json({ message: "You can't access this" });
    } catch (error) {
        console.error("Error during /template processing:", error);
        res.status(500).json({ message: "Internal server error", error:`message` });
    }
});

// Define the structure of a single message
interface Message {
    role: "user" | "system" | "assistant";
    content: string;
}

interface ChatRequestBody {
    messages: Message[];
}

//@ts-ignore
app.post("/chat", async (req,res) => {
    try {
        // Validate that messages exist and is an array
        const messages = req.body!.messages;


        if (!Array.isArray(messages)) {
            return res.status(400).json({
                message: "Invalid request: 'messages' must be an array of objects.",
            });
        }

        const systemPrompt = getSystemPrompt();

        // Format the messages
        const formattedMessages = [
            // // {
            //     role: "system",
            //     parts: [
            //         {
            //             text: systemPrompt,
            //         },
            //     ],
            // },
            ...messages.map((msg) => ({
                role: msg.role,
                parts: [
                    {
                        text: msg.content,
                    },
                ],
            })),
        ];

        console.log("Incoming Messages:", JSON.stringify(messages, null, 2));
         console.log("Formatted Messages for Gemini:", JSON.stringify(formattedMessages, null, 2));
        // const model = openai.getGenerativeModel({
        //     model: "gemini-1.5-flash",
        //     systemInstruction: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
        // });
        // Make the API call to the Gemini model
        const model = openai.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction:getSystemPrompt
        });

        const response = await model.generateContent({
            contents: formattedMessages,
            // Equivalent to max_tokens in the original code
        });

        console.log("Gemini Response:", JSON.stringify(response, null, 2));

        const reply = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
            throw new Error("No response received from Gemini API");
        }

        res.json({
            response: reply,
        });
    } catch (error) {
        console.error("Error in /chat endpoint:", error);
        res.status(500).json({
            message: "Internal server error",
            error: `message`,
        });
    }
});

app.listen(3000,() =>{
    console.log("Server is running on port 3000")
});

