import { Client } from "langsmith";
import { pull, push } from "langchain/hub/node";
import { PromptTemplate } from "@langchain/core/prompts";
import type { Prompt } from "langsmith/schemas";

export class PromptManager {
    client: Client;
    apiKey: string;

    constructor(apiKey: string) {
        this.client = new Client({ apiKey });
        this.apiKey = apiKey;
    }

    async listPrompts(query?: string): Promise<Array<Prompt>> {
        const prompts = await Array.fromAsync(this.client.listPrompts({ isPublic: false, isArchived: false, query })) ?? [];
        return prompts;
    }

    async getPrompt(promptId: string, promptVariables?: Record<string,unknown>): Promise<string | null> {
        const exists = await this.client.promptExists(promptId);
        if (!exists) return null;
        const promptTemplate = await pull(promptId, {
            apiKey: this.apiKey,
            includeModel: false
        });
        const prompt = await promptTemplate.invoke(promptVariables);
        return prompt ? prompt.value : null;
    }

    async createOrUpdatePrompt(promptId: string, newPrompt: string, templateFormat: "mustache" | "f-string" = "mustache", templateVariables: Array<Extract<string,string>> = [], description?: string): Promise<string> {
        return await push(promptId, new PromptTemplate({
            template: newPrompt,
            templateFormat: templateFormat,
            inputVariables: templateVariables
        }), {
            apiKey: this.apiKey,
            isPublic: false,
            description,
            tags: ["latest"]
        });
    }

    async deletePrompt(promptId: string): Promise<boolean> {
        try {
            await this.client.deletePrompt(promptId);
            return true;
        } catch (error) {
            console.error("Error deleting prompt:", error);
            return false;
        }
    }
}