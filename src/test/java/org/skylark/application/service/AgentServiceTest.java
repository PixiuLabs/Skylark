package org.skylark.application.service;

import io.agentscope.core.message.Msg;
import io.agentscope.core.tool.Toolkit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.skylark.infrastructure.config.LlmProperties;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for AgentService with AgentScope integration
 */
class AgentServiceTest {

    private AgentService agentService;

    @BeforeEach
    void setUp() {
        LlmProperties llmProperties = new LlmProperties();
        llmProperties.setApiKey("test-api-key");
        llmProperties.setModelName("test-model");
        llmProperties.setBaseUrl("https://test.api.com");
        
        agentService = new AgentService(llmProperties);
    }

    @Test
    void testInitialization() {
        assertNotNull(agentService);
        assertNotNull(agentService.getSystemPrompt());
        assertFalse(agentService.getSystemPrompt().isEmpty());
        assertNotNull(agentService.getToolkit());
    }

    @Test
    void testGetToolkit() {
        Toolkit toolkit = agentService.getToolkit();
        assertNotNull(toolkit);
    }

    @Test
    void testRegisterToolObject() {
        agentService.registerToolObject(new TestTools());
        assertNotNull(agentService.getToolkit());
    }

    @Test
    void testClearSession() {
        assertDoesNotThrow(() -> agentService.clearSession("non-existent"));
    }

    @Test
    void testGetSessionHistory_EmptySession() {
        List<Msg> history = agentService.getSessionHistory("non-existent");
        assertNotNull(history);
        assertTrue(history.isEmpty());
    }

    @Test
    void testGetActiveSessionCount_Initial() {
        assertEquals(0, agentService.getActiveSessionCount());
    }

    @Test
    void testClearSession_RemovesAgent() {
        agentService.clearSession("session-1");
        assertEquals(0, agentService.getActiveSessionCount());
    }

    @Test
    void testMultipleSessionsTracking() {
        assertEquals(0, agentService.getActiveSessionCount());
        agentService.clearSession("session-1");
        agentService.clearSession("session-2");
        assertEquals(0, agentService.getActiveSessionCount());
    }

    /**
     * Test tool class using AgentScope's @Tool annotation
     */
    static class TestTools {
        @io.agentscope.core.tool.Tool(name = "get_time", description = "Get current time")
        public String getTime(
                @io.agentscope.core.tool.ToolParam(name = "zone", description = "Time zone") String zone) {
            return java.time.LocalDateTime.now().toString();
        }
    }
}
