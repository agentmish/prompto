import { Client } from "langsmith";
import { pull, push } from "langchain/hub/node";
import { PromptTemplate, type TemplateFormat } from "@langchain/core/prompts";
import type { Prompt } from "langsmith/schemas";

export type PromptServiceClient = Pick<
    Client,
    "listPrompts" | "promptExists" | "deletePrompt" | "getPrompt"
>;

export interface PromptDefinition {
    template: string;
    templateFormat?: TemplateFormat;
    templateVariables?: string[];
    description?: string;
    tags?: string[];
    readme?: string;
    isPublic?: boolean;
}

export type PromptUpdate = Partial<PromptDefinition>;

export class PromptManager {
    client: PromptServiceClient;
    apiKey: string;

    constructor(apiKey: string, client?: PromptServiceClient) {
        this.apiKey = apiKey;
        this.client = client ?? new Client({ apiKey });
    }

    async listPrompts(query?: string): Promise<Array<Prompt>> {
        const prompts =
            (await Array.fromAsync(
                this.client.listPrompts({ isPublic: false, isArchived: false, query })
            )) ?? [];

        return prompts.sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
    }

    async getPrompt(
        promptId: string,
        promptVariables: Record<string, unknown> = {}
    ): Promise<string | null> {
        const exists = await this.client.promptExists(promptId);
        if (!exists) return null;
        const promptTemplate = await pull(promptId, {
            apiKey: this.apiKey,
            includeModel: false
        });
        const prompt = await promptTemplate.invoke(promptVariables);
        return prompt ? prompt.value : null;
    }

    async createPrompt(promptId: string, definition: PromptDefinition): Promise<string> {
        const templateFormat = definition.templateFormat ?? "mustache";
        const templateVariables = definition.templateVariables ?? [];

        const promptTemplate = new PromptTemplate({
            template: definition.template,
            templateFormat,
            inputVariables: templateVariables
        });

        return await push(promptId, promptTemplate, {
            apiKey: this.apiKey,
            description: definition.description,
            tags: definition.tags,
            readme: definition.readme,
            isPublic: definition.isPublic ?? false
        });
    }

    async updatePrompt(promptId: string, updates: PromptUpdate): Promise<string> {
        const exists = await this.client.promptExists(promptId);
        if (!exists) {
            throw new Error(`Prompt "${promptId}" does not exist. Use the create command instead.`);
        }

        const [currentPrompt, promptTemplate] = await Promise.all([
            this.client.getPrompt(promptId),
            pull(promptId, {
                apiKey: this.apiKey,
                includeModel: false
            })
        ]);

        if (!promptTemplate) {
            throw new Error(`Failed to load prompt "${promptId}".`);
        }

        const serialized = promptTemplate.serialize();
        const existingTemplate = serialized.template;
        if (existingTemplate && typeof existingTemplate !== "string") {
            throw new Error("Updating prompts with non-string templates is not supported.");
        }

        const template = updates.template ?? existingTemplate;
        if (template === undefined) {
            throw new Error(
                "Unable to determine existing template. Provide --template to overwrite explicitly."
            );
        }

        const templateFormat =
            updates.templateFormat ??
            (serialized.template_format as TemplateFormat | undefined) ??
            (promptTemplate.templateFormat as TemplateFormat | undefined) ??
            "mustache";
        const templateVariables =
            updates.templateVariables ??
            serialized.input_variables ??
            (promptTemplate.inputVariables as string[] | undefined) ??
            [];

        const prompt = new PromptTemplate({
            template,
            templateFormat,
            inputVariables: templateVariables
        });

        const description = updates.description ?? currentPrompt?.description;
        const tags = updates.tags ?? currentPrompt?.tags;
        const readme = updates.readme ?? currentPrompt?.readme;
        const isPublic = updates.isPublic ?? currentPrompt?.is_public ?? false;

        return await push(promptId, prompt, {
            apiKey: this.apiKey,
            description,
            tags,
            readme,
            isPublic
        });
    }

    async deletePrompt(promptId: string): Promise<void> {
        const exists = await this.client.promptExists(promptId);
        if (!exists) {
            throw new Error(`Prompt "${promptId}" does not exist.`);
        }

        await this.client.deletePrompt(promptId);
    }
}
