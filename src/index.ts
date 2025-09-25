#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import type { Ora } from "ora";
import CliTable3 from "cli-table3";
import type { Prompt } from "langsmith/schemas";

import { PromptManager } from "./manager.ts";

interface GlobalOptions {
    apiKey?: string;
}

const program = new Command();

program
    .name("prompto")
    .description("Browse and render LangSmith prompts from the command line.")
    .version("0.1.0")
    .option("--api-key <key>", "LangSmith API key (overrides LANGSMITH_API_KEY)")
    .showHelpAfterError("(run `prompto --help` for usage details)")
    .showSuggestionAfterError(true)
    .configureOutput({
        outputError: (str, write) => write(chalk.red(str))
    });

const CURSOR_RESET = "\u001B[?25h";

function resolveApiKey(command: Command): string {
    const globalOptions = command.optsWithGlobals<GlobalOptions>();
    const apiKey = globalOptions.apiKey ?? process.env.LANGSMITH_API_KEY;
    if (!apiKey) {
        throw new Error("Missing LangSmith API key. Set LANGSMITH_API_KEY or use --api-key <key>.");
    }
    return apiKey;
}

function createManager(command: Command): PromptManager {
    return new PromptManager(resolveApiKey(command));
}

function handleActionError(spinner: Ora | undefined, error: unknown): void {
    if (spinner?.isSpinning) {
        spinner.stop();
        process.stderr.write(CURSOR_RESET);
    }

    const message = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
    console.error(chalk.red(message));
    process.exitCode = 1;
}

function renderPromptTable(prompts: Prompt[]): void {
    const table = new CliTable3({
        head: [
            chalk.cyan("Full Name"),
            chalk.cyan("Updated"),
            chalk.cyan("Description"),
            chalk.cyan("Tags")
        ],
        wordWrap: true,
        style: {
            head: [],
            border: []
        }
    });

    for (const prompt of prompts) {
        const updated = new Date(prompt.updated_at).toLocaleString();
        table.push([
            chalk.bold(prompt.full_name),
            chalk.dim(updated),
            prompt.description ?? chalk.dim("—"),
            prompt.tags.length ? prompt.tags.join(", ") : chalk.dim("—")
        ]);
    }

    console.log(table.toString());
}

function parseVariables(raw: string[] | undefined): Record<string, string> | undefined {
    if (!raw?.length) return undefined;

    const result: Record<string, string> = {};
    for (const pair of raw) {
        const [key, ...rest] = pair.split("=");
        if (!key || rest.length === 0) {
            throw new Error(
                `Invalid variable "${pair}". Use key=value (e.g. --var audience=developers).`
            );
        }
        result[key] = rest.join("=");
    }
    return result;
}

program
    .command("list")
    .description("List private prompts available in LangSmith.")
    .option("-q, --query <query>", "Filter prompts by repository or owner handle.")
    .option("--json", "Output the raw JSON payload.", false)
    .action(async (options, command) => {
        const spinner = ora("Fetching prompts…").start();
        try {
            const manager = createManager(command);
            const prompts = await manager.listPrompts(options.query);
            spinner.stop();

            if (options.json) {
                console.log(JSON.stringify(prompts, null, 2));
                return;
            }

            if (!prompts.length) {
                console.log(chalk.yellow("No prompts found for your account."));
                return;
            }

            renderPromptTable(prompts);
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program
    .command("show")
    .argument("<promptId>", "Prompt identifier (e.g. org/prompt-name).")
    .description("Render a prompt locally, with optional variables.")
    .option("-v, --var <pair...>", "Provide prompt variables as key=value pairs.")
    .option("--json", "Return the result as JSON.", false)
    .action(async (promptId: string, options, command) => {
        let spinner: Ora | undefined;
        try {
            const vars = parseVariables(options.var);
            spinner = ora(`Fetching prompt "${promptId}"…`).start();

            const manager = createManager(command);
            const prompt = await manager.getPrompt(promptId, vars);

            if (!prompt) {
                spinner.fail(`Prompt "${promptId}" was not found.`);
                process.exitCode = 1;
                return;
            }

            spinner.stop();

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            id: promptId,
                            variables: vars ?? {},
                            prompt
                        },
                        null,
                        2
                    )
                );
                return;
            }

            console.log(chalk.bold.cyan(`\n${promptId}`));
            if (vars && Object.keys(vars).length > 0) {
                console.log(chalk.dim("Variables:"));
                for (const [key, value] of Object.entries(vars)) {
                    console.log(`  ${chalk.green(key)} = ${chalk.white(value)}`);
                }
                console.log("");
            }
            console.log(prompt);
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program.addHelpText(
    "afterAll",
    `\nExamples:\n  $ prompto list\n  $ prompto list --query onboarding\n  $ prompto show org/welcome --var name=Alex --var locale=en\n  $ prompto show org/welcome --json\n`
);

if (import.meta.main) {
    void program.parseAsync(process.argv);
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
    const parseOptions = argv === process.argv ? undefined : { from: "user" as const };
    await program.parseAsync(argv, parseOptions);
}

export { program };
