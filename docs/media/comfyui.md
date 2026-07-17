# ComfyUI Workflow Setup

Marinara Engine can send image-generation requests to a local ComfyUI server or a RunPod Serverless endpoint that runs ComfyUI. A local connection can use Marinara's built-in basic workflow, but a custom API-format workflow gives you control over checkpoints, LoRAs, VAEs, ControlNet, reference-image nodes, samplers, and other ComfyUI features.

The workflow JSON pasted into Marinara is a snapshot. Marinara does not keep a live link to the workflow open in ComfyUI. Whenever you change the workflow in ComfyUI, test it again, export it again, and replace the JSON saved on the Marinara connection.

## Before you begin

Install ComfyUI, add the checkpoints and custom nodes your workflow needs, and start its server. The usual local address is `http://127.0.0.1:8188`.

If ComfyUI runs on a different computer on your home network, its server must listen on an address that Marinara can reach. You must also set `IMAGE_LOCAL_URLS_ENABLED=true` in Marinara's `.env`; see the [Server Configuration Reference](../CONFIGURATION.md). Check the other computer's firewall if the connection still fails.

A local language model and an image model may not fit in GPU memory at the same time, especially on an 8 GB card. Marinara's image queue prevents multiple image jobs from running together, but it cannot make two loaded models fit into the same VRAM. If you run out of memory, use a cloud or separately hosted language model, run ComfyUI on another device, or unload one model before using the other.

## Create the Marinara connection

1. Open **Connections** and create a new **Image Generation** connection.
2. Choose **ComfyUI** for a local server or **RunPod Serverless (ComfyUI)** for a RunPod endpoint.
3. For local ComfyUI, enter its Base URL. No API key is required. If the **ComfyUI Workflow** field is empty, Marinara uses a built-in basic text-to-image workflow.
4. For RunPod, enter your API key and Endpoint ID. A custom workflow is required.
5. Configure **Local Image Defaults**. These values replace the matching placeholders in your workflow.
6. Save the connection and use **Test Image** after adding the workflow.

## Build and export a workflow

1. Create a separate workflow in ComfyUI for Marinara.
2. Configure and connect your checkpoint, LoRAs, VAE, prompt encoders, latent-image or image-input nodes, sampler, and output nodes as usual.
3. Queue the workflow in ComfyUI and confirm that it produces the expected image.
4. Include an output node. **SaveImage** is the safest choice because Marinara reads completed images or animations from ComfyUI's workflow history.
5. Save the editable workflow under a recognizable name, such as `Marinara_Workflow`.
6. Export the workflow in API format. Depending on the ComfyUI frontend version, this action may be named **Save (API Format)**, **Export (API)**, or **Export to API**. If it is hidden, enable ComfyUI's developer or dev-mode options.
7. Open the exported `.json` file in a text editor.

An API-format workflow is different from the normal visual-editor workflow. Its top-level keys are node IDs, and each node normally contains `class_type` and `inputs`. Export the API version; do not paste the regular workflow file containing the editor's visual layout.

## Add Marinara placeholders

Replace the values that Marinara should control with the placeholders below.

For a **local ComfyUI** connection, keep every placeholder inside JSON quotes. Marinara parses the workflow first, then converts an exact numeric placeholder such as `"%width%"` to a real number. It therefore remains valid for nodes that require numeric input.

For a **RunPod Serverless (ComfyUI)** connection, keep text placeholders such as `"%prompt%"`, `"%model%"`, and `"%sampler%"` quoted, but leave numeric placeholders such as `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%`, and `%clip_skip%` unquoted. RunPod substitution happens before Marinara parses the workflow, so the inserted number makes the submitted JSON valid. The connection editor may temporarily mark this template as invalid JSON because the unquoted token is not replaced until generation time; this warning does not prevent it from being saved.

The relevant parts of a basic **local** API workflow may look like this:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

This is only a fragment: keep the node links and other inputs from your exported workflow. You may embed prompt placeholders inside a longer string to prepend or append fixed tags. A numeric placeholder should normally be the entire value. In a RunPod copy of the workflow, remove the quotes around those numeric tokens. You can also leave any setting hard-coded when you do not want Marinara's connection defaults to change it.

| Placeholder           | Value supplied by Marinara                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | Positive image prompt. The connection editor warns if this is missing.                      |
| `%negative_prompt%`   | Negative image prompt.                                                                      |
| `%width%`, `%height%` | Requested image dimensions.                                                                 |
| `%seed%`              | Seed from the connection; `-1` produces a new random seed.                                  |
| `%model%`             | Model saved on the connection. Use the exact checkpoint value expected by your loader node. |
| `%steps%`             | Sampling steps.                                                                             |
| `%cfg%`               | CFG scale. `%cfg_scale%` and `%scale%` are also accepted.                                   |
| `%sampler%`           | Sampler name.                                                                               |
| `%scheduler%`         | Scheduler name.                                                                             |
| `%denoise%`           | Denoising strength. `%denoising_strength%` is also accepted.                                |
| `%clip_skip%`         | Clip Skip value for a compatible node.                                                      |

After editing, save the JSON, copy the entire file, paste it into **ComfyUI Workflow** on the image connection, save the connection, and click **Test Image**.

## Use reference images

Marinara can provide up to four reference images when the feature starting the generation has images to send. A custom workflow must contain compatible input nodes and placeholders; adding a placeholder does not create or connect those nodes automatically.

### Local ComfyUI: upload filenames for LoadImage

For a standard ComfyUI **LoadImage** node, use a filename placeholder:

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara uploads the reference to ComfyUI's input directory and replaces the placeholder with the filename returned by ComfyUI. `%reference_image_name%` means the first image. Workflows with several reference inputs can use `%reference_image_name_01%` through `%reference_image_name_04%`.

If the workflow always requires an image input, enable **Upload a 1x1 placeholder when no reference image is provided** in **Local Image Defaults**. Marinara then supplies a tiny placeholder image when the request has no real reference.

### Raw base64 image data

Use `%reference_image%` for the first raw base64 image, or `%reference_image_01%` through `%reference_image_04%` for numbered inputs. These values contain base64 data without a `data:image/...` prefix and only work with custom nodes that accept that format directly.

RunPod workflows support the raw base64 placeholders. The filename-upload placeholders are for local ComfyUI and are not available through the RunPod handler.

## Keep character-specific workflows

You can create a separate exported workflow and Marinara image connection for each character that needs a particular checkpoint, LoRA stack, ControlNet setup, or reference-image layout. Select the appropriate image connection wherever that character or image feature lets you choose one.

This can produce more consistent results than one generic workflow, but each connection still holds its own copied JSON. After changing a character's workflow in ComfyUI, repeat the export, edit, copy, and paste steps for that connection.

## Troubleshooting

| Problem                                          | What to check                                                                                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara reports invalid workflow JSON           | For local ComfyUI, check quotes, commas, and brackets after adding placeholders. For RunPod, only numeric placeholders should be unquoted; all text placeholders and the rest of the template still need correct JSON syntax. |
| The literal prompt or placeholder reaches a node | Confirm that the token is spelled exactly as listed and that the pasted workflow is the newly exported API version.                                                                                                           |
| The image ignores the requested dimensions       | Put `%width%` and `%height%` in the latent-image or equivalent size node that actually feeds the sampler.                                                                                                                     |
| ComfyUI cannot find the model                    | Use the exact checkpoint name expected by the loader, or keep the checkpoint hard-coded in the workflow instead of using `%model%`.                                                                                           |
| ComfyUI reports a missing node or input          | Install the same custom-node packages used when the workflow was built and confirm their input names have not changed.                                                                                                        |
| The job completes but Marinara receives no image | Add a connected **SaveImage** output and test the workflow directly in ComfyUI again.                                                                                                                                         |
| A reference-image node fails                     | For a normal local **LoadImage** node, use a `%reference_image_name...%` placeholder. Use raw base64 only with a node designed for it, and confirm that the Marinara feature actually supplied a reference.                   |
| A remote/LAN ComfyUI URL is blocked              | Enable `IMAGE_LOCAL_URLS_ENABLED`, make ComfyUI listen on the network interface, and check the host firewall. Do not expose an unauthenticated ComfyUI server to the public internet.                                         |
| A long generation times out                      | Increase `COMFYUI_GEN_TIMEOUT` in Marinara's `.env`. The value is measured in seconds and defaults to `2400`.                                                                                                                 |
| Generation runs out of GPU memory                | Reduce image dimensions or model size, unload the local language model, use a remote language model, or move ComfyUI to another device.                                                                                       |

## Related guides

- [Image Generation Providers and Setup](image-providers.md) covers all supported image services and shared image settings.
- [Image Style Profiles](style-profiles.md) explains Marinara's reusable prompt styles.
- [Illustrator Agent](illustrator-agent.md) covers automatic scene illustration.
- [Server Configuration Reference](../CONFIGURATION.md) documents local-network access and ComfyUI timeouts.
- [ComfyUI workflow concepts](https://docs.comfy.org/development/core-concepts/workflow) explains workflows in the official ComfyUI documentation.
