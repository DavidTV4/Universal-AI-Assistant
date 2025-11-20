import { 
  GoogleGenAI, 
  FunctionDeclaration, 
  Type,
  Chat, 
  LiveServerMessage,
  Modality,
  FunctionCall
} from "@google/genai";
import { ImageGenerationResult } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Define the tool for image generation
const generateImageTool: FunctionDeclaration = {
  name: 'create_image',
  description: 'Generates a high-quality image based on a detailed user description. Use this when the user explicitly asks for an image or visual content.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'A detailed, descriptive prompt for the image generation model. Include style, lighting, mood, and subject details.',
      },
    },
    required: ['prompt'],
  },
};

const SYSTEM_INSTRUCTION = `
You are an AI assistant that can:
1. Create images,
2. Generate clean, well-structured code,
3. Summarize text clearly and concisely.

When I give you a command, automatically detect whether I want an image, code, or summary.

- **Image tasks**: Call the \`create_image\` tool with a detailed prompt.
- **Code tasks**: Produce optimized, commented code in the language requested. Use Markdown code blocks.
- **Summary tasks**: Summarize text into short, medium, or long formats as needed.

Always ask 1 clarifying question if my instruction is unclear.
`;

let chatSession: Chat | null = null;

export const initializeChat = () => {
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [generateImageTool] }],
    },
  });
};

export const generateImage = async (prompt: string): Promise<ImageGenerationResult> => {
  try {
    // Using Imagen 3 (via the 4.0 alias) for high quality
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg',
      },
    });

    const image = response.generatedImages?.[0]?.image;
    if (image && image.imageBytes) {
      return {
        success: true,
        data: image.imageBytes,
        mimeType: 'image/jpeg'
      };
    }
    return { success: false, error: 'No image generated.' };
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    return { success: false, error: error.message || 'Failed to generate image.' };
  }
};

/**
 * Sends a message to the chat model. 
 * Handles tool calls for image generation internally.
 */
export const sendMessage = async (
  message: string, 
  onImageGenerated: (imageData: string) => void
): Promise<string> => {
  if (!chatSession) initializeChat();
  if (!chatSession) throw new Error("Chat session failed to initialize");

  try {
    const response = await chatSession.sendMessage({ message });
    
    // Check for function calls
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'create_image') {
        const args = call.args as { prompt: string };
        
        // Execute the actual image generation
        const imageResult = await generateImage(args.prompt);

        let toolResultContent: any = { result: "Image generation failed." };

        if (imageResult.success && imageResult.data) {
          // Callback to UI to show the image immediately
          onImageGenerated(imageResult.data);
          toolResultContent = { result: "Image generated successfully and displayed to the user." };
        } else {
          toolResultContent = { result: `Error: ${imageResult.error}` };
        }

        // Send the tool result back to the model so it can finalize the turn
        const followUpResponse = await chatSession.sendToolResponse({
          functionResponses: {
            name: call.name,
            id: call.id,
            response: toolResultContent
          }
        });

        return followUpResponse.text || "Here is the image you requested.";
      }
    }

    return response.text || "";

  } catch (error: any) {
    console.error("Chat Error:", error);
    return `Sorry, I encountered an error: ${error.message}`;
  }
};

/**
 * Live API Client for Voice Interaction
 */
export class GeminiLive {
  private audioContext: AudioContext | null = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private sessionPromise: Promise<any> | null = null;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';
  private onTranscriptUpdate: (userText: string, modelText: string, isFinal: boolean) => void;
  private onImageGenerated: (imageData: string) => void;
  private onStatusChange: (active: boolean) => void;

  constructor(
    onTranscriptUpdate: (user: string, model: string, final: boolean) => void,
    onImageGenerated: (data: string) => void,
    onStatusChange: (active: boolean) => void
  ) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onImageGenerated = onImageGenerated;
    this.onStatusChange = onStatusChange;
  }

  async connect(voiceName: string = 'Kore') {
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.onStatusChange(true);

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: () => {
            console.log('Live session closed');
            this.disconnect();
          },
          onerror: (e) => {
            console.error('Live session error', e);
            this.disconnect();
          }
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [generateImageTool] }],
        }
      });
    } catch (error) {
      console.error("Failed to start live session:", error);
      this.disconnect();
      throw error;
    }
  }

  disconnect() {
    this.onStatusChange(false);
    
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // We can't explicitly "close" the session via the SDK client easily in this version 
    // without retaining the session object, but cleaning up the stream breaks the loop.
    this.sessionPromise = null;
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
  }

  private handleOpen() {
    if (!this.stream || !this.inputAudioContext) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (e) => {
      if (!this.sessionPromise) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const base64 = this.encodeAudio(inputData);
      
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64
          }
        });
      });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Audio
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.audioContext) {
      this.playAudio(audioData);
    }

    // Handle Transcriptions
    if (message.serverContent?.outputTranscription) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
      this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription, false);
    }
    
    if (message.serverContent?.inputTranscription) {
      this.currentInputTranscription += message.serverContent.inputTranscription.text;
      this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription, false);
    }

    // Handle Turn Complete
    if (message.serverContent?.turnComplete) {
      this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription, true);
      this.currentInputTranscription = '';
      this.currentOutputTranscription = '';
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
      this.stopAudio();
      this.currentOutputTranscription = ''; 
      this.nextStartTime = 0;
    }

    // Handle Tool Calls
    if (message.toolCall) {
      this.handleToolCall(message.toolCall);
    }
  }

  private async handleToolCall(toolCall: any) {
    const calls = toolCall.functionCalls;
    if (!calls || calls.length === 0) return;

    for (const call of calls) {
      if (call.name === 'create_image') {
        const args = call.args as { prompt: string };
        const result = await generateImage(args.prompt);
        
        let responseContent = "Image generation failed.";
        if (result.success && result.data) {
          this.onImageGenerated(result.data);
          responseContent = "Image generated successfully.";
        } else {
          responseContent = `Error: ${result.error}`;
        }

        this.sessionPromise?.then(session => {
          session.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result: responseContent }
            }]
          });
        });
      }
    }
  }

  private async playAudio(base64Data: string) {
    if (!this.audioContext) return;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = this.audioContext.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      this.nextStartTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
      
    } catch (e) {
      console.error("Error playing audio chunk", e);
    }
  }

  private stopAudio() {
    this.sources.forEach(s => s.stop());
    this.sources.clear();
  }

  private encodeAudio(inputData: Float32Array): string {
    const l = inputData.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}