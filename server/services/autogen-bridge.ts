/**
 * Bridge between Node.js backend and Python AutoGen
 * Enables integration of AutoGen debates with existing system
 */

import { spawn } from 'child_process';
import * as path from 'path';
import type { ChatMessage } from '@shared/schema';

export interface DebateMessage {
    name: string;
    content: string;
    role?: string;
}

export interface DebateResult {
    problem: string;
    messages: DebateMessage[];
    rounds: number;
    consensusReached: boolean;
    finalMessage?: DebateMessage;
    error?: string;
}

export interface DebateOptions {
    maxRounds?: number;
    useModerator?: boolean;
    useOllama?: boolean;
    apiKey?: string;
}

export class AutoGenBridge {
    private pythonPath: string;
    private scriptPath: string;

    constructor() {
        this.pythonPath = process.env.PYTHON_PATH || 'python3';
        this.scriptPath = path.join(process.cwd(), 'autogen_mistral.py');
    }

    /**
     * Run a debate using AutoGen
     */
    async runDebate(
        problem: string,
        options: DebateOptions = {}
    ): Promise<DebateResult> {
        const {
            maxRounds = 5,
            useModerator = false,
            useOllama = true,
            apiKey
        } = options;

        return new Promise((resolve, reject) => {
            const args = [
                this.scriptPath,
                '--problem', problem,
                '--max-rounds', maxRounds.toString(),
                '--output', 'json'
            ];

            if (useModerator) {
                args.push('--use-moderator');
            }

            if (useOllama) {
                args.push('--use-ollama');
            }

            if (apiKey) {
                args.push('--api-key', apiKey);
            }

            console.log(`Running AutoGen debate: ${problem}`);
            console.log(`Command: ${this.pythonPath} ${args.join(' ')}`);

            const python = spawn(this.pythonPath, args);

            let stdout = '';
            let stderr = '';
            let jsonOutput = '';

            python.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;

                // Try to extract JSON from output
                const jsonMatch = output.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonOutput = jsonMatch[0];
                }
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`AutoGen stderr: ${data}`);
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python process exited with code ${code}`);
                    console.error(`stderr: ${stderr}`);
                    reject(new Error(`AutoGen process failed with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Try to parse JSON output
                    const result = jsonOutput ? JSON.parse(jsonOutput) : JSON.parse(stdout);

                    // Transform to our format
                    const debateResult: DebateResult = {
                        problem: result.problem,
                        messages: result.messages || [],
                        rounds: result.rounds || 0,
                        consensusReached: result.consensus_reached || false,
                        finalMessage: result.final_message,
                        error: result.error
                    };

                    console.log(`Debate completed: ${debateResult.rounds} rounds, consensus: ${debateResult.consensusReached}`);
                    resolve(debateResult);
                } catch (error) {
                    console.error('Failed to parse debate result:', error);
                    console.error('stdout:', stdout);
                    reject(new Error(`Failed to parse debate result: ${error}`));
                }
            });

            python.on('error', (error) => {
                console.error('Failed to start Python process:', error);
                reject(new Error(`Failed to start AutoGen: ${error.message}`));
            });
        });
    }

    /**
     * Convert debate messages to ChatMessage format
     */
    convertToChatMessages(debateResult: DebateResult, demandId: number): ChatMessage[] {
        return debateResult.messages.map((msg, index) => ({
            id: `${demandId}-debate-${index}`,
            agent: msg.name || 'unknown',
            message: msg.content,
            timestamp: new Date().toISOString(),
            type: 'completed' as const,
            category: msg.name === 'critic' ? 'question' as const : 'answer' as const
        }));
    }

    /**
     * Check if Python and AutoGen are available
     */
    async checkAvailability(): Promise<{ available: boolean; error?: string }> {
        return new Promise((resolve) => {
            const python = spawn(this.pythonPath, ['-c', 'import autogen; print("OK")']);

            let output = '';
            let error = '';

            python.stdout.on('data', (data) => {
                output += data.toString();
            });

            python.stderr.on('data', (data) => {
                error += data.toString();
            });

            python.on('close', (code) => {
                if (code === 0 && output.includes('OK')) {
                    resolve({ available: true });
                } else {
                    resolve({
                        available: false,
                        error: `AutoGen not available: ${error || 'Module not found'}`
                    });
                }
            });

            python.on('error', (err) => {
                resolve({
                    available: false,
                    error: `Python not available: ${err.message}`
                });
            });
        });
    }
}

export const autoGenBridge = new AutoGenBridge();
