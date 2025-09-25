import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prompt } from "langsmith/schemas";
import type { PromptServiceClient } from "../src/manager.ts";

vi.mock("langchain/hub/node", () => ({
    pull: vi.fn(),
    push: vi.fn()
}));

const { PromptManager } = await import("../src/manager.ts");
const { pull, push } = await import("langchain/hub/node");

const pullMock = vi.mocked(pull);
const pushMock = vi.mocked(push);

type MockSerializedPrompt = {
    template?: string;
    template_format?: string;
    input_variables?: string[];
};

type MockPulledPrompt = {
    serialize: () => MockSerializedPrompt;
    templateFormat?: string;
    inputVariables?: string[];
};

const buildPrompt = (overrides: Partial<Prompt>): Prompt => ({
    repo_handle: "org/prompt",
    id: overrides.id ?? "prompt-id",
    tenant_id: "tenant",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2024-01-01T00:00:00.000Z",
    is_public: false,
    is_archived: false,
    tags: overrides.tags ?? [],
    full_name: overrides.full_name ?? "org/prompt",
    num_likes: 0,
    num_downloads: 0,
    num_views: 0,
    liked_by_auth_user: false,
    num_commits: 1,
    description: overrides.description,
    readme: overrides.readme,
    original_repo_id: overrides.original_repo_id,
    upstream_repo_id: overrides.upstream_repo_id,
    owner: overrides.owner,
    last_commit_hash: overrides.last_commit_hash,
    original_repo_full_name: overrides.original_repo_full_name,
    upstream_repo_full_name: overrides.upstream_repo_full_name
});

const generatorFrom = <T>(items: T[]) =>
    (async function* generator() {
        for (const item of items) {
            yield item;
        }
    })();

describe("PromptManager", () => {
    let client: PromptServiceClient;
    let listPromptsMock: ReturnType<typeof vi.fn<PromptServiceClient["listPrompts"]>>;
    let promptExistsMock: ReturnType<typeof vi.fn<PromptServiceClient["promptExists"]>>;
    let deletePromptMock: ReturnType<typeof vi.fn<PromptServiceClient["deletePrompt"]>>;
    let getPromptMock: ReturnType<typeof vi.fn<PromptServiceClient["getPrompt"]>>;

    beforeEach(() => {
        listPromptsMock = vi.fn<PromptServiceClient["listPrompts"]>();
        promptExistsMock = vi.fn<PromptServiceClient["promptExists"]>();
        deletePromptMock = vi.fn<PromptServiceClient["deletePrompt"]>();
        getPromptMock = vi.fn<PromptServiceClient["getPrompt"]>();

        client = {
            listPrompts: listPromptsMock,
            promptExists: promptExistsMock,
            deletePrompt: deletePromptMock,
            getPrompt: getPromptMock
        };
        vi.clearAllMocks();
        pushMock.mockReset();
        pullMock.mockReset();
    });

    it("returns prompts sorted by updated date", async () => {
        const prompts = [
            buildPrompt({
                id: "first",
                full_name: "org/first",
                updated_at: "2024-01-01T00:00:00.000Z"
            }),
            buildPrompt({
                id: "second",
                full_name: "org/second",
                updated_at: "2024-02-01T00:00:00.000Z"
            })
        ];
        listPromptsMock.mockImplementation(() => generatorFrom(prompts));

        const manager = new PromptManager("test", client);
        const result = await manager.listPrompts();

        expect(listPromptsMock).toHaveBeenCalledWith({
            isArchived: false,
            isPublic: false,
            query: undefined
        });
        expect(result.map((prompt) => prompt.id)).toEqual(["second", "first"]);
    });

    it("returns rendered prompt content when it exists", async () => {
        const promptValue = "Hello, world";
        const invoke = vi.fn().mockResolvedValue({ value: promptValue });
        pullMock.mockResolvedValue({ invoke } as unknown as { invoke: typeof invoke });
        promptExistsMock.mockResolvedValue(true);

        const manager = new PromptManager("test", client);
        const result = await manager.getPrompt("org/prompt", { name: "Ava" });

        expect(promptExistsMock).toHaveBeenCalledWith("org/prompt");
        expect(pullMock).toHaveBeenCalledWith("org/prompt", {
            apiKey: "test",
            includeModel: false
        });
        expect(invoke).toHaveBeenCalledWith({ name: "Ava" });
        expect(result).toBe(promptValue);
    });

    it("returns null when prompt does not exist", async () => {
        promptExistsMock.mockResolvedValue(false);

        const manager = new PromptManager("test", client);
        const result = await manager.getPrompt("missing/prompt");

        expect(result).toBeNull();
        expect(pullMock).not.toHaveBeenCalled();
    });

    it("creates a prompt with metadata", async () => {
        const manager = new PromptManager("test", client);

        await manager.createPrompt("org/new", {
            template: "Hi {{name}}",
            templateFormat: "mustache",
            templateVariables: ["name"],
            tags: ["beta"],
            description: "Greeting",
            readme: "# Hello",
            isPublic: true
        });

        expect(pushMock).toHaveBeenCalledWith(
            "org/new",
            expect.objectContaining({ templateFormat: "mustache", inputVariables: ["name"] }),
            expect.objectContaining({
                apiKey: "test",
                tags: ["beta"],
                description: "Greeting",
                readme: "# Hello",
                isPublic: true
            })
        );
    });

    it("updates only provided fields and preserves existing data", async () => {
        promptExistsMock.mockResolvedValue(true);
        const serialize = vi.fn<MockPulledPrompt["serialize"]>().mockReturnValue({
            template: "Hello {{name}}",
            template_format: "mustache",
            input_variables: ["name"]
        });
        pullMock.mockResolvedValue({
            serialize,
            templateFormat: "mustache",
            inputVariables: ["name"]
        } as unknown as MockPulledPrompt);
        getPromptMock.mockResolvedValue(
            buildPrompt({
                tags: ["original"],
                description: "Original",
                readme: "# Readme",
                is_public: false
            })
        );

        const manager = new PromptManager("test", client);
        await manager.updatePrompt("org/prompt", {
            templateVariables: ["name", "role"],
            tags: ["updated"],
            isPublic: true
        });

        expect(pushMock).toHaveBeenCalledWith(
            "org/prompt",
            expect.objectContaining({ inputVariables: ["name", "role"] }),
            expect.objectContaining({
                tags: ["updated"],
                description: "Original",
                readme: "# Readme",
                isPublic: true
            })
        );
    });

    it("throws when updating a missing prompt", async () => {
        promptExistsMock.mockResolvedValue(false);

        const manager = new PromptManager("test", client);
        await expect(manager.updatePrompt("missing/prompt", {})).rejects.toThrow(/does not exist/i);
    });

    it("checks existence before deleting", async () => {
        promptExistsMock.mockResolvedValue(true);

        const manager = new PromptManager("test", client);
        await manager.deletePrompt("org/prompt");

        expect(promptExistsMock).toHaveBeenCalledWith("org/prompt");
        expect(deletePromptMock).toHaveBeenCalledWith("org/prompt");
    });

    it("throws when deleting a missing prompt", async () => {
        promptExistsMock.mockResolvedValue(false);

        const manager = new PromptManager("test", client);
        await expect(manager.deletePrompt("missing/prompt")).rejects.toThrow(/does not exist/i);
    });
});
