package org.skylark.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * LLM (Large Language Model) Configuration Properties
 * 大语言模型配置属性
 *
 * <p>Type-safe configuration properties for LLM, including model name and base URL.
 * API key should be provided via environment variable for security.</p>
 *
 * @author Skylark Team
 * @version 2.0.0
 */
@Configuration
@ConfigurationProperties(prefix = "llm")
public class LlmProperties {

    private String apiKey = "";

    private String modelName = "";

    private String baseUrl = "";

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
}
