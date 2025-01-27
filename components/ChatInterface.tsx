'use client'

import { Doc, Id } from "@/convex/_generated/dataModel";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import WelcomeMessage from "./WelcomeMessage";
import { ChatRequestBody } from "@/lib/types";

interface ChatInterfaceProps {
    chatId: Id<"chats">;
    initialMessages: Doc<"messages">[];
}
function ChatInterface({ chatId, initialMessages }: ChatInterfaceProps) {
    const [ messages, setMessages ] = useState<Doc<"messages">[]>(initialMessages);
    const [ input, setInput ] = useState("");
    const [ isLoading, setIsLoading ] = useState(false);
    const [ streamedResponse, setStreamedResponse ] = useState("");
    const [ currentTool, setCurrentTool ] = useState<{
        name: string;
        input: unknown;
    } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [ messages, streamedResponse ]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedInput = input.trim();
        if (!trimmedInput || isLoading) return;

        setInput("");
        setStreamedResponse('');
        setCurrentTool(null);
        setIsLoading(true);

        const optimisticUserMessage: Doc<"messages"> = {
            _id: `temp_${Date.now()}`,
            chatId,
            content: trimmedInput,
            role: "user",
            createdAt: Date.now(),

        } as Doc<"messages">;

        setMessages((prev) => [ ...prev, optimisticUserMessage ]);

        let fullResponse = '';

        try {
            const requestBody: ChatRequestBody = {
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                newMessage: trimmedInput,
                chatId,
            }

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) throw new Error(await response.text())
            if (!response.body) throw new Error('Response body is not available')





        } catch (error) {
            console.error(error);

            setMessages((pre) => pre.filter(msg => msg._id !== optimisticUserMessage._id));

            setStreamedResponse("error")

        } finally {
            setIsLoading(false);
        }




    }

    return (
        <main className="flex flex-col h-[calc(100vh-theme(spacing.14))]">
            {/* Messages container */ }
            <section className="flex-1 overflow-y-auto bg-gray-50 p-2 md:p-0">
                <div className="max-w-4xl mx-auto p-4 space-y-3">
                    { messages?.length === 0 && <WelcomeMessage /> }

                    {/* { messages?.map((message: Doc<"messages">) => (
                    //     <MessageBubble
                    //         key={ message._id }
                    //         content={ message.content }
                    //         isUser={ message.role === "user" }
                    //     />
                    // )) } */}

                    {/* { streamedResponse && <MessageBubble content={ streamedResponse } /> } */ }

                    {/* Loading indicator */ }
                    {/* { isLoading && !streamedResponse && (
                        <div className="flex justify-start animate-in fade-in-0">
                            <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 rounded-bl-none shadow-sm ring-1 ring-inset ring-gray-200">
                                <div className="flex items-center gap-1.5">
                                    { [ 0.3, 0.15, 0 ].map((delay, i) => (
                                        <div
                                            key={ i }
                                            className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
                                            style={ { animationDelay: `-${delay}s` } }
                                        />
                                    )) }
                                </div>
                            </div>
                        </div>
                    ) } */}
                    <div
                        ref={ messagesEndRef }
                    />
                </div>
            </section>

            {/* Input form */ }
            <footer className="border-t bg-white p-4">
                <form
                    onSubmit={ handleSubmit }
                    className="max-w-4xl mx-auto relative"
                >
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={ input }
                            onChange={ (e) => setInput(e.target.value) }
                            placeholder="Message AI Agent..."
                            className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 bg-gray-50 placeholder:text-gray-500"
                            disabled={ isLoading }
                        />
                        <Button
                            type="submit"
                            disabled={ isLoading || !input.trim() }
                            className={ `absolute right-1.5 rounded-xl h-9 w-9 p-0 flex items-center justify-center transition-all ${input.trim()
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                : "bg-gray-100 text-gray-400"
                                }` }
                        >
                            <ArrowRight />
                        </Button>
                    </div>
                </form>
            </footer>
        </main>
    );
}
export default ChatInterface;
