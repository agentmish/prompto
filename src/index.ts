/* Usage Sample */

// import { PromptManager } from "./manager";

// const pm = new PromptManager(process.env.LANGSMITH_API_KEY || "");
// const prompts = await pm.listPrompts();
// console.log(prompts);

// let prompt = await pm.getPrompt("gemini-docsearch");
// console.log(prompt);

// prompt = prompt?.replace('name="DocSherpa"', 'name="DocGPT"') ?? prompt;
// const updated = await pm.createOrUpdatePrompt("test", prompt ?? "", "mustache");
// console.log(updated);