export function preserveLegacyModelSelection<TModel extends string>(
	selectedModel: TModel | "custom",
	customModel: string,
	availableModels: ReadonlySet<TModel>,
): { selectedModel: TModel | "custom"; customModel: string } {
	if (selectedModel !== "custom" && !availableModels.has(selectedModel)) {
		return {
			selectedModel: "custom",
			customModel: customModel || selectedModel,
		};
	}

	return {
		selectedModel,
		customModel,
	};
}

export function getPreservedModelOptions(
	selectedModel: string,
	availableModels: readonly string[],
): string[] {
	const options = Array.from(
		new Set(availableModels.filter((model) => model && model !== "custom")),
	).sort((a, b) => a.localeCompare(b));

	if (selectedModel && selectedModel !== "custom" && !options.includes(selectedModel)) {
		options.unshift(selectedModel);
	}

	options.push("custom");
	return options;
}
