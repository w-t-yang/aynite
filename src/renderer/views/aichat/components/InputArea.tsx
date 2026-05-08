import { forwardRef } from 'react'
import { type ChatInputHandle, InputEditor } from './InputEditor'

interface InputAreaProps {
  loading: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onClear: () => void
  workspaceFolders: string[]
  getFiles: (path: string) => Promise<any>
  getAllFiles: () => Promise<any>
  getAvailableSkills: () => Promise<any>
  getAvailableCommands: () => Promise<any>
}

export const InputArea = forwardRef<ChatInputHandle, InputAreaProps>(
  (
    {
      loading,
      onSend,
      onAbort,
      onClear,
      workspaceFolders,
      getFiles,
      getAllFiles,
      getAvailableSkills,
      getAvailableCommands,
    },
    ref,
  ) => {
    return (
      <div className="absolute bottom-0 left-0 right-0 px-12 pb-10 bg-gradient-to-t from-background via-background to-transparent z-layout">
        <div className="max-w-[900px] mx-auto relative group">
          <InputEditor
            ref={ref}
            placeholder="Type your message or use / for skills..."
            onSend={onSend}
            loading={loading}
            onAbort={onAbort}
            onClear={onClear}
            workspaceFolders={workspaceFolders}
            getFiles={getFiles}
            getAllFiles={getAllFiles}
            getAvailableSkills={getAvailableSkills}
            getAvailableCommands={getAvailableCommands}
          />
        </div>
      </div>
    )
  },
)

InputArea.displayName = 'InputArea'
