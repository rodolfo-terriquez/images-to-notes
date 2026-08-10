import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const helperSource = await readFile(
	new URL("../utils/modelSelection.ts", import.meta.url),
	"utf8",
);
const helperJavaScript = ts.transpileModule(helperSource, {
	compilerOptions: {
		module: ts.ModuleKind.ES2020,
		target: ts.ScriptTarget.ES2020,
	},
}).outputText;
const { getPreservedModelOptions, preserveLegacyModelSelection } = await import(
	`data:text/javascript;base64,${Buffer.from(helperJavaScript).toString("base64")}`
);

test("keeps every known model selection unchanged", () => {
	const models = new Set(["existing-model", "new-model"]);

	assert.deepEqual(
		preserveLegacyModelSelection("existing-model", "", models),
		{ selectedModel: "existing-model", customModel: "" },
	);
	assert.deepEqual(
		preserveLegacyModelSelection("new-model", "", models),
		{ selectedModel: "new-model", customModel: "" },
	);
});

test("preserves a legacy model ID through the custom-model path", () => {
	assert.deepEqual(
		preserveLegacyModelSelection("legacy-model", "", new Set(["current-model"])),
		{ selectedModel: "custom", customModel: "legacy-model" },
	);
});

test("does not replace an existing custom model value", () => {
	assert.deepEqual(
		preserveLegacyModelSelection("legacy-model", "user-chosen-model", new Set()),
		{ selectedModel: "custom", customModel: "user-chosen-model" },
	);
	assert.deepEqual(
		preserveLegacyModelSelection("custom", "user-chosen-model", new Set()),
		{ selectedModel: "custom", customModel: "user-chosen-model" },
	);
});

test("keeps the saved Copilot model visible when a refresh omits it", () => {
	assert.deepEqual(
		getPreservedModelOptions("saved-model", ["other-model", "another-model"]),
		["saved-model", "another-model", "other-model", "custom"],
	);
});

test("keeps the saved Copilot model visible when a refresh fails", () => {
	assert.deepEqual(getPreservedModelOptions("saved-model", []), ["saved-model", "custom"]);
	assert.deepEqual(getPreservedModelOptions("custom", []), ["custom"]);
});
