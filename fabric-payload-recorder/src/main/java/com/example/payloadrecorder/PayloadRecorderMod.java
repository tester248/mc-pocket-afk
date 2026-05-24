package com.example.payloadrecorder;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Payload Recorder Mod
 *
 * This mod listens for connection events and generates a template Fabric profile JSON.
 * Note: Due to API changes in 1.21.11, actual packet capturing requires server-side
 * interception or external tools like packet capture proxies.
 *
 * For now, this mod generates a template that users can populate with their server's payloads.
 */
public class PayloadRecorderMod implements ClientModInitializer {

    private static final Path PROFILE_PATH = Paths.get("fabric-profile-template.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    @Override
    public void onInitializeClient() {
        System.out.println("[PayloadRecorder] Fabric Payload Recorder mod loaded for Minecraft 1.21.11");

        // When the player joins a world
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            System.out.println("[PayloadRecorder] Player joined world");
            generateTemplateProfile();
        });
    }

    /**
     * Generates a template Fabric profile JSON that users can populate.
     */
    private void generateTemplateProfile() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("gameVersion", "1.21.11");
        profile.put("note", "Edit this file with your server's actual Fabric payloads. See README for instructions.");

        // Example register payload (base64 encoded "example_register_data")
        profile.put("registerPayloadBase64", "ZXhhbXBsZV9yZWdpc3Rlcl9kYXRh");

        // Example channel payloads
        List<Map<String, String>> channels = new ArrayList<>();

        Map<String, String> exampleChannel = new LinkedHashMap<>();
        exampleChannel.put("channel", "fabric:example_channel");
        exampleChannel.put("dataBase64", "ZXhhbXBsZV9jaGFubmVsX2RhdGE=");
        exampleChannel.put("note", "Replace with your server's actual channel payloads");
        channels.add(exampleChannel);

        profile.put("channels", channels);

        // Write to file
        try (FileWriter writer = new FileWriter(PROFILE_PATH.toFile())) {
            GSON.toJson(profile, writer);
            System.out.println("[PayloadRecorder] ✓ Template profile written to: " + PROFILE_PATH.toAbsolutePath());
        } catch (IOException e) {
            System.err.println("[PayloadRecorder] ✗ Failed to write template: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
