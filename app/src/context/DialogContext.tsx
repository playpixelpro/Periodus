import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

export interface DialogOptions {
  title: string
  message?: string
  copyableText?: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
  input?: {
    placeholder?: string
    defaultValue?: string
    type?: 'text' | 'password' | 'number'
    helperText?: string
  }
}

interface DialogState extends DialogOptions {
  mode: 'alert' | 'confirm' | 'prompt'
  resolve: (value: any) => void
}

interface DialogContextType {
  confirm: (options: DialogOptions | string) => Promise<boolean>
  prompt: (options: DialogOptions | string, defaultValue?: string) => Promise<string | null>
  alert: (options: DialogOptions | string) => Promise<void>
}

const DialogContext = createContext<DialogContextType | null>(null)

export function useDialog(): DialogContextType {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return ctx
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const alert = useCallback((options: DialogOptions | string): Promise<void> => {
    const opts: DialogOptions = typeof options === 'string' ? { title: options } : options
    return new Promise((resolve) => {
      setDialog({
        ...opts,
        mode: 'alert',
        resolve,
      })
    })
  }, [])

  const confirm = useCallback((options: DialogOptions | string): Promise<boolean> => {
    const opts: DialogOptions = typeof options === 'string' ? { title: options } : options
    return new Promise((resolve) => {
      setDialog({
        ...opts,
        mode: 'confirm',
        resolve,
      })
    })
  }, [])

  const prompt = useCallback(
    (options: DialogOptions | string, defaultValue = ''): Promise<string | null> => {
      const opts: DialogOptions =
        typeof options === 'string'
          ? { title: options, input: { defaultValue } }
          : {
              ...options,
              input: {
                defaultValue,
                ...options.input,
              },
            }
      setInputValue(opts.input?.defaultValue ?? '')
      return new Promise((resolve) => {
        setDialog({
          ...opts,
          mode: 'prompt',
          resolve,
        })
      })
    },
    [],
  )

  useEffect(() => {
    if (dialog?.mode === 'prompt') {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [dialog])

  const handleConfirm = () => {
    if (!dialog) return
    const res = dialog.resolve
    const mode = dialog.mode
    setDialog(null)
    setCopied(false)
    if (mode === 'prompt') {
      res(inputValue)
    } else if (mode === 'confirm') {
      res(true)
    } else {
      res(undefined)
    }
  }

  const handleCancel = () => {
    if (!dialog) return
    const res = dialog.resolve
    const mode = dialog.mode
    setDialog(null)
    setCopied(false)
    if (mode === 'prompt') {
      res(null)
    } else if (mode === 'confirm') {
      res(false)
    } else {
      res(undefined)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {dialog && (
        <div className="custom-dialog-backdrop" role="dialog" aria-modal="true">
          <div
            className={`custom-dialog-card ${dialog.isDanger ? 'is-danger' : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel()
              if (e.key === 'Enter' && dialog.mode !== 'alert') handleConfirm()
            }}
          >
            <div className="custom-dialog-header">
              <h3 className="custom-dialog-title">{dialog.title}</h3>
            </div>

            {dialog.message && (
              <p className="custom-dialog-message">{dialog.message}</p>
            )}

            {dialog.copyableText && (
              <div className="custom-dialog-code-box">
                <code>{dialog.copyableText}</code>
                <button
                  type="button"
                  className="custom-dialog-copy-btn"
                  onClick={() => handleCopy(dialog.copyableText!)}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            )}

            {dialog.mode === 'prompt' && (
              <div className="custom-dialog-input-wrap">
                <input
                  ref={inputRef}
                  type={dialog.input?.type || 'text'}
                  placeholder={dialog.input?.placeholder || ''}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="custom-dialog-input"
                />
                {dialog.input?.helperText && (
                  <span className="custom-dialog-helper">{dialog.input.helperText}</span>
                )}
              </div>
            )}

            <div className="custom-dialog-actions">
              {dialog.mode !== 'alert' && (
                <button
                  type="button"
                  className="custom-dialog-btn custom-dialog-cancel"
                  onClick={handleCancel}
                >
                  {dialog.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                className={`custom-dialog-btn custom-dialog-confirm ${
                  dialog.isDanger ? 'danger-btn' : ''
                }`}
                onClick={handleConfirm}
              >
                {dialog.confirmText || (dialog.mode === 'alert' ? 'Got it' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}
