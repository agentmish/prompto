import { beforeEach, describe, expect, it, vi } from "vitest";

const listPromptsMock = vi.fn();
const getPromptMock = vi.fn();
const PromptManagerMock = vi.fn().mockImplementation(() => ({
    listPrompts: listPromptsMock,
    getPrompt: getPromptMock
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
        })
    };
    return spinner;
};

const oraMock = vi.fn((text: string) => createMockSpinner(text));

vi.mock("../src/manager.ts", () => ({
    PromptManager: PromptManagerMock
}));

vi.mock("ora", () => ({
    default: oraMock
}));

const { runCli, program } = await import("../src/index.ts");

program.exitOverride();

describe("CLI", () => {
    beforeEach(() => {
        listPromptsMock.mockReset();
        getPromptMock.mockReset();
        PromptManagerMock.mockClear();
        oraMock.mockClear();
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
});
