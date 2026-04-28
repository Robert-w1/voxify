RubyLLM.configure do |config|
  config.openai_api_key = ENV.fetch("GITHUB_TOKEN", nil)
  config.openai_api_base = "https://models.inference.ai.azure.com"
  # ... see RubyLLM configuration guide for other models
end
