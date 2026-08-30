package com.playpixelpro.myperiod;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.genai.common.DownloadCallback;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.inference.InferenceSession;
import com.google.mlkit.genai.inference.InferenceSessionOptions;
import com.google.mlkit.genai.inference.OutputOptions;
import com.google.mlkit.genai.inference.TextInference;
import com.google.mlkit.genai.inference.TextInferenceClient;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import androidx.annotation.NonNull;

/**
 * Capacitor plugin exposing Gemini Nano (ML Kit GenAI) on-device inference.
 *
 * Registered separately from LunaraNativePlugin so the dependency is isolated:
 * the app still compiles and runs on devices without AICore; the JS bridge
 * simply receives { available: false } from geminiNanoStatus().
 *
 * Minimum Android 9 (API 28) is required to even attempt a status check.
 * Actual model availability additionally requires a Gemini Nano-capable device
 * with AICore installed (Pixel 8+, Galaxy S24+, etc.).
 */
@CapacitorPlugin(name = "LunaraNano")
public class GeminiNanoPlugin extends Plugin {

    // The minimum Android version to attempt any GenAI API call.
    // AICore itself requires API 31+, but we guard at 28 for the status call.
    private static final int MIN_API_LEVEL = Build.VERSION_CODES.P; // 28

    private TextInferenceClient inferenceClient = null;

    // -----------------------------------------------------------------------
    // Status check — always safe to call, returns immediately
    // -----------------------------------------------------------------------

    /**
     * Checks whether Gemini Nano is available on this device.
     *
     * Returns a JSObject with:
     *   available  boolean  true only when the model is fully ready for inference
     *   status     string   'available' | 'downloading' | 'downloadable' | 'not-supported'
     *   reason     string   human-readable explanation (empty when available)
     */
    @PluginMethod
    public void geminiNanoStatus(PluginCall call) {
        if (Build.VERSION.SDK_INT < MIN_API_LEVEL) {
            call.resolve(statusResult(false, "not-supported", "Requires Android 9 or newer."));
            return;
        }

        try {
            TextInferenceClient client = getOrCreateClient();
            int featureStatus = client.checkFeatureStatus().getResult();
            call.resolve(featureStatusToResult(featureStatus));
        } catch (Exception e) {
            // AICore is not installed or the device does not support it.
            call.resolve(statusResult(false, "not-supported",
                "Gemini Nano is not available on this device: " + e.getMessage()));
        }
    }

    // -----------------------------------------------------------------------
    // Model download — trigger on Wi-Fi before first inference
    // -----------------------------------------------------------------------

    /**
     * Initiates a model download if the model is downloadable but not yet present.
     * Resolves immediately; the download happens in the background.
     * The client should poll geminiNanoStatus() to track progress.
     */
    @PluginMethod
    public void geminiNanoDownload(PluginCall call) {
        if (Build.VERSION.SDK_INT < MIN_API_LEVEL) {
            call.reject("Gemini Nano requires Android 9 or newer.", "NOT_SUPPORTED");
            return;
        }

        try {
            TextInferenceClient client = getOrCreateClient();
            client.downloadFeature(new DownloadCallback() {
                @Override
                public void onDownloadStarted(long bytesDownloaded) {
                    // Download has begun — caller polls status separately
                }

                @Override
                public void onDownloadFailed(Exception e) {
                    // Non-fatal; caller will see status remain 'downloadable'
                }

                @Override
                public void onDownloadCompleted() {
                    // Model is now 'available'; next geminiNanoStatus() call will reflect this
                }
            });
            call.resolve(new JSObject().put("started", true));
        } catch (Exception e) {
            call.reject("Could not start Gemini Nano download: " + e.getMessage(),
                "DOWNLOAD_FAILED", e);
        }
    }

    // -----------------------------------------------------------------------
    // Inference — run a prompt through Gemini Nano
    // -----------------------------------------------------------------------

    /**
     * Runs a prompt through the on-device Gemini Nano model.
     *
     * Input:  { prompt: string }
     * Output: { text: string }
     *
     * This is a blocking call on a background thread; Capacitor's @PluginMethod
     * dispatcher runs it on a separate thread by default.
     */
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void geminiNanoInfer(PluginCall call) {
        if (Build.VERSION.SDK_INT < MIN_API_LEVEL) {
            call.reject("Gemini Nano requires Android 9 or newer.", "NOT_SUPPORTED");
            return;
        }

        String prompt = call.getString("prompt");
        if (prompt == null || prompt.trim().isEmpty()) {
            call.reject("A non-empty prompt is required.", "INVALID_ARGUMENT");
            return;
        }

        try {
            TextInferenceClient client = getOrCreateClient();

            // Verify the model is actually ready before attempting inference
            int status = client.checkFeatureStatus().getResult();
            if (status != FeatureStatus.AVAILABLE) {
                call.reject(
                    "Gemini Nano model is not ready yet (status: " + featureStatusLabel(status) + ").",
                    "MODEL_NOT_READY"
                );
                return;
            }

            // Create an inference session
            InferenceSessionOptions sessionOptions = new InferenceSessionOptions.Builder()
                .setTemperature(0.5f)
                .setTopK(40)
                .build();

            InferenceSession session = client.createInferenceSession(sessionOptions)
                .getResult();

            // Run the prompt
            StringBuilder output = new StringBuilder();
            OutputOptions outputOptions = new OutputOptions.Builder()
                .setMaxOutputTokens(512)
                .build();

            session.runInference(prompt, outputOptions,
                partialResult -> output.append(partialResult)
            ).getResult();

            session.close();

            call.resolve(new JSObject().put("text", output.toString().trim()));

        } catch (Exception e) {
            call.reject("Gemini Nano inference failed: " + e.getMessage(),
                "INFERENCE_FAILED", e);
        }
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    @Override
    protected void handleOnDestroy() {
        if (inferenceClient != null) {
            try {
                inferenceClient.close();
            } catch (Exception ignored) {}
            inferenceClient = null;
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private synchronized TextInferenceClient getOrCreateClient() {
        if (inferenceClient == null) {
            TextInference textInference = new TextInference(getContext());
            inferenceClient = textInference.getClient();
        }
        return inferenceClient;
    }

    private JSObject featureStatusToResult(int featureStatus) {
        switch (featureStatus) {
            case FeatureStatus.AVAILABLE:
                return statusResult(true, "available", "");
            case FeatureStatus.DOWNLOADABLE:
                return statusResult(false, "downloadable",
                    "Gemini Nano is available but needs to download (~1 GB). Connect to Wi-Fi.");
            case FeatureStatus.DOWNLOADING:
                return statusResult(false, "downloading",
                    "Gemini Nano model is downloading in the background.");
            default:
                return statusResult(false, "not-supported",
                    "This device does not support Gemini Nano (AICore not available).");
        }
    }

    private String featureStatusLabel(int status) {
        switch (status) {
            case FeatureStatus.AVAILABLE:    return "available";
            case FeatureStatus.DOWNLOADABLE: return "downloadable";
            case FeatureStatus.DOWNLOADING:  return "downloading";
            default:                         return "not-supported";
        }
    }

    private JSObject statusResult(boolean available, String status, String reason) {
        return new JSObject()
            .put("available", available)
            .put("status", status)
            .put("reason", reason);
    }
}
