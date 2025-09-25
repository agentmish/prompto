#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import type { Ora } from "ora";
import CliTable3 from "cli-table3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prompt } from "langsmith/schemas";

import { PromptManager, type PromptDefinition, type PromptUpdate } from "./manager.ts";

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

function parseJsonOption(optionName: string, raw?: string): unknown {
    if (raw === undefined) return undefined;
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Invalid JSON for ${optionName}: ${(error as Error).message}`);
    }
}

function ensureStringArray(value: unknown, optionName: string): string[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) {
        const mapped = value.map((entry) => {
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object") {
                const record = entry as Record<string, unknown>;
                if (typeof record.name === "string") return record.name;
                if (typeof record.key === "string") return record.key;
            }
            throw new Error(
                `Expected ${optionName} to be an array of strings or objects with a name.`
            );
        });
        return mapped;
    }

    if (value && typeof value === "object") {
        return Object.keys(value as Record<string, unknown>);
    }

    throw new Error(`Expected ${optionName} to be JSON describing an array or object.`);
}

async function loadTextInput(
    inline: string | undefined,
    filePath: string | undefined,
    label: string
): Promise<string | undefined> {
    if (inline && filePath) {
        throw new Error(`Specify either ${label} or ${label}-file, not both.`);
    }
    if (filePath) {
        const absolutePath = path.resolve(process.cwd(), filePath);
        return await readFile(absolutePath, "utf8");
    }
    return inline;
}

function resolveVisibility(options: {
    public?: boolean;
    private?: boolean | undefined;
}): boolean | undefined {
    if (options.public && options.private) {
        throw new Error("Choose either --public or --private, not both.");
    }
    if (options.public) return true;
    if (options.private) return false;
    return undefined;
}

async function writePromptToFile(prompt: string, destination: string): Promise<void> {
    const resolvedPath = path.resolve(process.cwd(), destination);
    const directory = path.dirname(resolvedPath);
    await mkdir(directory, { recursive: true });
    await writeFile(resolvedPath, prompt, "utf8");
    console.log(chalk.green(`Saved prompt to ${resolvedPath}`));
}

const VALID_TEMPLATE_FORMATS = new Set(["mustache", "f-string"]);

function resolveTemplateFormat(
    format: string | undefined,
    context: string
): PromptDefinition["templateFormat"] {
    if (format === undefined) return undefined;
    if (!VALID_TEMPLATE_FORMATS.has(format)) {
        throw new Error(
            `${context} must be one of: ${Array.from(VALID_TEMPLATE_FORMATS).join(", ")}`
        );
    }
    return format as PromptDefinition["templateFormat"];
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
    .option("-s, --save <path>", "Persist the rendered prompt to a file.")
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
                if (options.save) {
                    await writePromptToFile(prompt, options.save);
                }
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
            if (options.save) {
                await writePromptToFile(prompt, options.save);
            }
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program
    .command("create")
    .argument("<promptId>", "Prompt identifier (e.g. org/prompt-name).")
    .description("Create a new LangSmith prompt.")
    .option("-t, --template <template>", "Prompt template content.")
    .option("--template-file <file>", "Load prompt template from a file.")
    .option("--format <format>", "Template format (mustache|f-string).", "mustache")
    .option("--variables <json>", "JSON describing template variables (array/object).")
    .option("--tags <json>", "JSON array describing metadata tags.")
    .option("--description <text>", "Prompt description.")
    .option("--readme <text>", "Prompt README content.")
    .option("--readme-file <file>", "Load README content from a file.")
    .option("--public", "Make the prompt public.", false)
    .action(async (promptId: string, options, command) => {
        const spinner = ora(`Creating prompt "${promptId}"…`).start();
        try {
            const template = await loadTextInput(
                options.template,
                options.templateFile,
                "--template"
            );
            if (!template) {
                throw new Error("A template is required. Provide --template or --template-file.");
            }

            const readme = await loadTextInput(options.readme, options.readmeFile, "--readme");
            const variablesJson = parseJsonOption("--variables", options.variables);
            const tagsJson = parseJsonOption("--tags", options.tags);
            const variables = ensureStringArray(variablesJson, "--variables");
            const tags = tagsJson === undefined ? undefined : ensureStringArray(tagsJson, "--tags");

            const promptDefinition: PromptDefinition = {
                template,
                templateFormat: resolveTemplateFormat(options.format, "--format"),
                templateVariables: variables,
                description: options.description,
                readme,
                tags,
                isPublic: options.public
            };

            const manager = createManager(command);
            const location = await manager.createPrompt(promptId, promptDefinition);
            spinner.succeed(`Created prompt at ${location}`);
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program
    .command("update")
    .argument("<promptId>", "Prompt identifier to update.")
    .description("Update an existing prompt with new content or metadata.")
    .option("-t, --template <template>", "Prompt template content.")
    .option("--template-file <file>", "Load prompt template from a file.")
    .option("--format <format>", "Template format (mustache|f-string).")
    .option("--variables <json>", "JSON describing template variables (array/object).")
    .option("--tags <json>", "JSON array describing metadata tags.")
    .option("--description <text>", "Prompt description.")
    .option("--readme <text>", "Prompt README content.")
    .option("--readme-file <file>", "Load README content from a file.")
    .option("--public", "Mark the prompt as public.")
    .option("--private", "Mark the prompt as private.")
    .action(async (promptId: string, options, command) => {
        const spinner = ora(`Updating prompt "${promptId}"…`).start();
        try {
            const template = await loadTextInput(
                options.template,
                options.templateFile,
                "--template"
            );
            const readme = await loadTextInput(options.readme, options.readmeFile, "--readme");
            const variablesJson = parseJsonOption("--variables", options.variables);
            const tagsJson = parseJsonOption("--tags", options.tags);
            const variables =
                variablesJson === undefined
                    ? undefined
                    : ensureStringArray(variablesJson, "--variables");
            const tags = tagsJson === undefined ? undefined : ensureStringArray(tagsJson, "--tags");
            const isPublic = resolveVisibility(options);

            const updates: PromptUpdate = {};
            if (template !== undefined) updates.template = template;
            const format = resolveTemplateFormat(options.format, "--format");
            if (format) updates.templateFormat = format;
            if (variables !== undefined) updates.templateVariables = variables;
            if (tags !== undefined) updates.tags = tags;
            if (options.description !== undefined) updates.description = options.description;
            if (readme !== undefined) updates.readme = readme;
            if (isPublic !== undefined) updates.isPublic = isPublic;

            if (Object.keys(updates).length === 0) {
                throw new Error("Nothing to update. Provide at least one option.");
            }

            const manager = createManager(command);
            const location = await manager.updatePrompt(promptId, updates);
            spinner.succeed(`Updated prompt. Latest version available at ${location}`);
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program
    .command("delete")
    .argument("<promptId>", "Prompt identifier to delete.")
    .description("Delete a prompt after confirming it exists.")
    .action(async (promptId: string, _options, command) => {
        const spinner = ora(`Deleting prompt "${promptId}"…`).start();
        try {
            const manager = createManager(command);
            await manager.deletePrompt(promptId);
            spinner.succeed(`Deleted prompt "${promptId}".`);
        } catch (error) {
            handleActionError(spinner, error);
        }
    });

program.addHelpText(
    "afterAll",
    `\nExamples:\n  $ prompto list\n  $ prompto list --query onboarding\n  $ prompto show org/welcome --var name=Alex --var locale=en --save prompt.txt\n  $ prompto create org/new --template-file welcome.mustache --variables '["name"]'\n  $ prompto update org/new --public --tags '["beta"]'\n  $ prompto delete org/new\n`
);

if (import.meta.main) {
    void program.parseAsync(process.argv);
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
    const parseOptions = argv === process.argv ? undefined : { from: "user" as const };
    await program.parseAsync(argv, parseOptions);
}

export { program };
