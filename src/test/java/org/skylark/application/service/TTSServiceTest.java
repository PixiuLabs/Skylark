package org.skylark.application.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for TTSService
 */
class TTSServiceTest {

    private TTSService ttsService;

    @BeforeEach
    void setUp() throws Exception {
        ttsService = new TTSService();
        // Set test configuration using reflection
        ReflectionTestUtils.setField(ttsService, "defaultVoice", "cmu-slt-hsmm");
        ReflectionTestUtils.setField(ttsService, "tempDir", "temp/tts-test");
        ReflectionTestUtils.setField(ttsService, "maryTtsUrl", "http://localhost:59125");
        
        // Manually initialize HttpClient and test connection
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        ReflectionTestUtils.setField(ttsService, "httpClient", httpClient);
        
        // Try to test connection, if MaryTTS is running, set available to true
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:59125/"))
                    .GET()
                    .timeout(Duration.ofSeconds(5))
                    .build();
            
            httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            ReflectionTestUtils.setField(ttsService, "maryTTSAvailable", true);
            System.out.println("MaryTTS is available, will use real synthesis");
        } catch (Exception e) {
            System.out.println("MaryTTS not available, will use placeholder: " + e.getMessage());
            ReflectionTestUtils.setField(ttsService, "maryTTSAvailable", false);
        }
    }

    @Test
    void testSynthesize_EnglishText() throws Exception {
        String testText = "Welcome to the world of speech synthesis! Hello, this is a test of the text-to-speech system. It should generate a valid WAV audio file with actual sound.";
        String voice = "cmu-slt-hsmm";

        // Perform synthesis
        File audioFile = ttsService.synthesize(testText, voice);

        // Verify the result
        assertNotNull(audioFile);
        assertTrue(audioFile.exists(), "Audio file should exist");
        assertTrue(audioFile.length() > 0, "Audio file should not be empty");
        assertTrue(audioFile.getName().endsWith(".wav"), "File should have .wav extension");

        // Log the file location for verification
        System.out.println("Test audio file generated at: " + audioFile.getAbsolutePath());
        System.out.println("File size: " + audioFile.length() + " bytes");
        System.out.println("Note: If MaryTTS was running, this file should play correctly!");
    }

    @Test
    void testSynthesize_NullText_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize(null, "cmu-slt-hsmm");
        });
    }

    @Test
    void testSynthesize_EmptyText_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize("", "cmu-slt-hsmm");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize("   ", "cmu-slt-hsmm");
        });
    }

    @Test
    void testSynthesize_NullVoice_UsesDefault() throws Exception {
        String testText = "Testing default voice";

        File audioFile = ttsService.synthesize(testText, null);

        assertNotNull(audioFile);
        assertTrue(audioFile.exists());

        System.out.println("Default voice test file generated at: " + audioFile.getAbsolutePath());
    }

    @Test
    void testListVoices() {
        var result = ttsService.listVoices();

        assertNotNull(result);
        assertTrue(result.containsKey("voices"));
        assertFalse(((java.util.List<?>) result.get("voices")).isEmpty());
    }
}
