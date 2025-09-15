import {UIToolInvocation, tool } from "ai"
import {z} from "zod";

export const weatherTool = ({

    async *execute({city}: {city: string}){
        yield {state: 'loading' as const}
    }
})

export type WeatherUIToolInvocation = UIToolInvocation<typeof weatherTool>

//--------------

export default function WeatherView({
    invocation,
}: {
    invocation: WeatherUIToolInvocation
}) {

    switch (invocation.state) {
        case "input-streaming":
            return <>{/* .... */}</>
        case "input-available":
            return (
                <div>Getting weather infomration for {invocation.input.city} ...</div>
            )
        case "output-available":
            return (
                <div>
                    {invocation.output.state === "loading" 
                        ? "Fetching weather information ..."
                        : `Weather in ${invocation.input.city}: ${invocation.output.weather}`
                    }
                </div>
            )
        case "output-error":
            return <div className="text-red-500"> Error: {invocation.errorText} </div>
    }
}

// ------ agent definitions
import {
    Experimental_Agent as Agent,
    Experimental_InferAgentUIMessage as InferAgentUIMessage,
    stepCountIs, 
  } from "ai"

export const weatherAgent = new Agent({
    model: 'openai/gpt-5',
    system: 'You are a helpful assistant',
    tools: {
        weather: weatherTool
    },
    stopWhen: stepCountIs(10)
})

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent >

// --- route uses the agent and sends current ui message inputs

import { validateUIMessages } from "ai";

export async function POST(request: Request){
    const body = await request.json()
    return weatherAgent.respond({
        messages: await validateUIMessages({messages: body.messages})
    })
}
//----- finally pages composes the ui 
"use client"
import {useChat} from "@ai-sdk/react"

export default function Chat() {
    const {status, sendMessage, messages} = useChat<WeatherAgentUIMessage>()

    return (
        <div>
            {messages?.map ((message) => (
                <div key={message.id} > 
                
                <strong>{`${message.role}: `}</strong>
                {message.parts.map((part, index) => {
                    switch (part.type){
                        case "text":
                            return <div key={index}> {part.text} </div>
                        case "tool-weather": {
                            return <WeatherView invocation={part} />
                        }
                    }
                })}
                </div>
            ))}
            <ChatInput status={status} onSubmit={(text: any) => sendMessage({text})} />
        </div>
    )
}

// ---- THIS IS JUST A CONCEPT ... but 
// npm i @artifacts @store  
// install a set of tools like artifacts to define components and store to register components

// and then

// Define an artifact ... like BurnRate ... a component wholly defined with zod
// maybe the styling is all configured as default unless overridden

const BurnRate = artifact('burn-rate', z.object({
  title: z.string(),
  data: z.array(z.object({
    month: z.string(),
    burnRate: z.number()
  }))
}));

// Stream from AI tool
const analysis = BurnRate.stream({ title: 'Q4 Analysis' });
await analysis.update({ data: [{ month: '2024-01', burnRate: 50000 }] });
await analysis.complete({ title: 'Q4 Analysis Complete' });

// Consume in React
function Dashboard() {
  const { data, status, progress } = useArtifact(BurnRate);
  
  return (
    <div>
      <h2>{data?.title}</h2>
      {status === 'loading' && <div>Loading... {progress * 100}%</div>}
      {data?.data.map(item => (
        <div key={item.month}>{item.month}: ${item.burnRate}</div>
      ))}
    </div>
  );
}
