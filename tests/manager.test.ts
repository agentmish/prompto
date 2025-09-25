import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prompt } from "langsmith/schemas";
import type { PromptServiceClient } from "../src/manager.ts";

vi.mock("langchain/hub/node", () => ({
    pull: vi.fn(),
    push: vi.fn()
}));

const { PromptManager } = await import("../src/manager.ts");
const { pull } = await import("langchain/hub/node");

const pullMock = vi.mocked(pull);

const createPrompt = (overrides: Partial<Prompt>): Prompt => ({
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

    beforeEach(() => {
        listPromptsMock = vi.fn<PromptServiceClient["listPrompts"]>();
        promptExistsMock = vi.fn<PromptServiceClient["promptExists"]>();
        deletePromptMock = vi.fn<PromptServiceClient["deletePrompt"]>();

        client = {
            listPrompts: listPromptsMock,
            promptExists: promptExistsMock,
            deletePrompt: deletePromptMock
        };
        vi.clearAllMocks();
    });

    it("returns prompts sorted by updated date", async () => {
        const prompts = [
            createPrompt({
                id: "first",
                full_name: "org/first",
                updated_at: "2024-01-01T00:00:00.000Z"
            }),
            createPrompt({
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
});
