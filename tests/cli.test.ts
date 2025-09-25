import { beforeEach, describe, expect, it, vi } from "vitest";

const listPromptsMock = vi.fn();
const getPromptMock = vi.fn();
const createPromptMock = vi.fn();
const updatePromptMock = vi.fn();
const deletePromptMock = vi.fn();
const PromptManagerMock = vi.fn().mockImplementation(() => ({
    listPrompts: listPromptsMock,
    getPrompt: getPromptMock,
    createPrompt: createPromptMock,
    updatePrompt: updatePromptMock,
    deletePrompt: deletePromptMock
}));

const createMockSpinner = (text: string) => {
    const spinner = {
        text,
        isSpinning: false,
        start: vi.fn().mockImplementation(() => {
            spinner.isSpinning = true;
            return spinner;
        }),
        stop: vi.fn().mockImplementation(() => {
            spinner.isSpinning = false;
            return spinner;
        }),
        fail: vi.fn().mockImplementation(() => {
            spinner.isSpinning = false;
            return spinner;
        }),
        succeed: vi.fn().mockImplementation(() => {
            spinner.isSpinning = false;
            return spinner;
        })
    };
    return spinner;
};

const oraMock = vi.fn((text: string) => createMockSpinner(text));

const mkdirMock = vi.fn().mockResolvedValue(undefined);
const readFileMock = vi.fn();
const writeFileMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/manager.ts", () => ({
    PromptManager: PromptManagerMock
}));

vi.mock("ora", () => ({
    default: oraMock
}));

vi.mock("node:fs/promises", () => ({
    mkdir: mkdirMock,
    readFile: readFileMock,
    writeFile: writeFileMock
}));

const { runCli, program } = await import("../src/index.ts");

program.exitOverride();

describe("CLI", () => {
    beforeEach(() => {
        listPromptsMock.mockReset();
        getPromptMock.mockReset();
        createPromptMock.mockReset();
        updatePromptMock.mockReset();
        deletePromptMock.mockReset();
        PromptManagerMock.mockClear();
        oraMock.mockClear();
        mkdirMock.mockClear();
        readFileMock.mockReset();
        writeFileMock.mockClear();
        process.exitCode = 0;
        process.env.LANGSMITH_API_KEY = "test-key";
    });

    it("lists prompts as JSON when requested", async () => {
        const prompt = {
            full_name: "org/prompt",
            updated_at: "2024-03-01T00:00:00.000Z",
            description: "Sample",
            tags: ["latest"]
        };
        listPromptsMock.mockResolvedValue([prompt]);
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await runCli(["list", "--json"]);

        expect(PromptManagerMock).toHaveBeenCalledWith("test-key");
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"full_name": "org/prompt"'));

        logSpy.mockRestore();
    });

    it("displays prompt content and variables", async () => {
        listPromptsMock.mockResolvedValue([]);
        getPromptMock.mockResolvedValue("Hello, Taylor!");
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await runCli(["show", "org/welcome", "--var", "name=Taylor", "--json"]);

        expect(getPromptMock).toHaveBeenCalledWith("org/welcome", { name: "Taylor" });
        expect(logSpy).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    id: "org/welcome",
                    variables: { name: "Taylor" },
                    prompt: "Hello, Taylor!"
                },
                null,
                2
            )
        );

        logSpy.mockRestore();
    });

    it("reports missing API key", async () => {
        process.env.LANGSMITH_API_KEY = "";
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await runCli(["list"]);

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing LangSmith API key"));
        expect(process.exitCode).toBe(1);

        errorSpy.mockRestore();
    });

    it("saves rendered prompt to disk", async () => {
        getPromptMock.mockResolvedValue("Hello there");
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await runCli(["show", "org/welcome", "--save", "output.txt"]);

        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringMatching(/output\.txt$/),
            "Hello there",
            "utf8"
        );
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Saved prompt"));

        logSpy.mockRestore();
    });

    it("creates a prompt", async () => {
        createPromptMock.mockResolvedValue("https://hub/prompts/org/new");

        await runCli([
            "create",
            "org/new",
            "--template",
            "Hello {{name}}",
            "--variables",
            '["name"]',
            "--tags",
            '["beta"]',
            "--public"
        ]);

        expect(createPromptMock).toHaveBeenCalledWith(
            "org/new",
            expect.objectContaining({
                template: "Hello {{name}}",
                templateVariables: ["name"],
                tags: ["beta"],
                isPublic: true
            })
        );
    });

    it("updates prompt metadata only", async () => {
        updatePromptMock.mockResolvedValue("https://hub/prompts/org/existing");

        await runCli(["update", "org/existing", "--variables", '["name","role"]', "--private"]);

        expect(updatePromptMock).toHaveBeenCalledWith("org/existing", {
            templateVariables: ["name", "role"],
            isPublic: false
        });
    });

    it("deletes a prompt", async () => {
        deletePromptMock.mockResolvedValue(undefined);

        await runCli(["delete", "org/remove"]);

        expect(deletePromptMock).toHaveBeenCalledWith("org/remove");
    });
});
