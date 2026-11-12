'use client'

import { type ChangeEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { saveSettings } from '@/lib/actions'
import { toast } from 'sonner'
import { settingsSchema } from '@/lib/validation'

type Form = z.input<typeof settingsSchema>
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DATA_URL_LENGTH = 180_000
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function processAvatar(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a photo smaller than 5 MB.')

  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24_000_000) {
      throw new Error('Choose a valid photo smaller than 24 megapixels.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser cannot prepare this photo.')

    const square = Math.min(image.naturalWidth, image.naturalHeight)
    context.drawImage(
      image,
      (image.naturalWidth - square) / 2,
      (image.naturalHeight - square) / 2,
      square,
      square,
      0,
      0,
      256,
      256
    )
    const dataUrl = canvas.toDataURL('image/webp', 0.78)
    if (!dataUrl.startsWith('data:image/webp;base64,') || dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error('Photo is too large after resizing. Please choose another.')
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(source)
  }
}

export function SettingsForm({ initial }: { initial: Form }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const form = useForm<Form>({ resolver: zodResolver(settingsSchema), defaultValues: initial })
  const selectedAvatar = useWatch({ control: form.control, name: 'avatarUrl' }) || ''
  const isUpload = selectedAvatar.startsWith('data:image/')

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoMessage('')
    setPreparing(true)
    try {
      const dataUrl = await processAvatar(file)
      form.setValue('avatarUrl', dataUrl, { shouldDirty: true, shouldValidate: true })
      setPhotoMessage('Photo ready. Save your settings to publish it.')
    } catch (error) {
      setPhotoMessage(error instanceof Error ? error.message : 'Could not prepare the photo.')
    } finally {
      setPreparing(false)
    }
  }

  async function submit(values: Form) {
    setBusy(true)
    const result = await saveSettings(values)
    setBusy(false)
    setMessage(result.ok ? 'Settings saved.' : result.error)
    if (result.ok) {
      if (values.themePreference === 'system') localStorage.removeItem('study-theme')
      else localStorage.setItem('study-theme', values.themePreference)
      toast.success('Settings saved')
      setPhotoMessage('')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="card manage-card form-grid">
      <div className="field">
        <label htmlFor="display-name">Display name</label>
        <input id="display-name" className="input" {...form.register('displayName')} />
      </div>

      <div className="field full">
        <label>Profile photo / brand picture</label>
        <div className="avatar-picker">
          <div className="avatar-picker-preview">
            {selectedAvatar ? (
              // Only HTTPS image links or browser-generated image data URLs are saved.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedAvatar} alt="Preview of your chosen avatar" referrerPolicy="no-referrer" />
            ) : (
              <span>SL</span>
            )}
          </div>
          <div className="avatar-picker-controls">
            <p className="avatar-picker-hint">Your personal photo appears in your workspace and on your public study profile. The website logo is shared by everyone.</p>
            <div className="avatar-picker-actions">
              <label htmlFor="avatar-file" className="button button-secondary">Choose photo</label>
              <input
                id="avatar-file"
                className="avatar-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
                disabled={busy || preparing}
                aria-label="Choose profile photo"
              />
              <button
                className="button button-ghost"
                type="button"
                disabled={busy || preparing || !selectedAvatar}
                onClick={() => {
                  form.setValue('avatarUrl', '', { shouldDirty: true, shouldValidate: true })
                  setPhotoMessage('Photo cleared. Save your settings to apply.')
                }}
              >Remove photo</button>
            </div>
            <p className="avatar-picker-note">JPG, PNG, or WebP · up to 5 MB · automatically cropped and optimized.</p>
            {preparing && <p className="avatar-picker-note" role="status">Preparing your photo…</p>}
            {photoMessage && <p className="avatar-picker-note" role="status">{photoMessage}</p>}
          </div>
        </div>
        <input type="hidden" {...form.register('avatarUrl')} />
        <details className="avatar-url-option">
          <summary>Or use a direct image URL</summary>
          <input
            className="input"
            type="url"
            aria-label="Direct image URL"
            placeholder={isUpload ? 'Using your uploaded picture' : 'https://example.com/avatar.jpg'}
            value={isUpload ? '' : selectedAvatar}
            onChange={event => {
              form.setValue('avatarUrl', event.target.value, { shouldDirty: true, shouldValidate: true })
              setPhotoMessage('')
            }}
            disabled={busy || preparing}
          />
          <p className="avatar-picker-note">Use a direct HTTPS image link, not the URL of a page displaying an image.</p>
        </details>
      </div>

      <div className="field full">
        <label htmlFor="biography">Biography</label>
        <textarea id="biography" rows={3} {...form.register('biography')} />
      </div>
      <div className="field full">
        <label htmlFor="study-goal">Study goal</label>
        <input id="study-goal" className="input" placeholder="What are you working toward?" {...form.register('studyGoal')} />
      </div>
      <div className="field">
        <label htmlFor="daily-target">Daily target (minutes)</label>
        <input id="daily-target" className="input" type="number" min="1" max="1440" {...form.register('dailyTargetMinutes')} />
      </div>
      <div className="field">
        <label htmlFor="timezone">Timezone</label>
        <input id="timezone" className="input" list="timezones" {...form.register('timezone')} />
        <datalist id="timezones">
          <option value="Africa/Casablanca" />
          <option value="UTC" />
          <option value="Europe/London" />
          <option value="Europe/Paris" />
          <option value="America/New_York" />
          <option value="Asia/Tokyo" />
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="profile-visibility">Profile visibility</label>
        <select id="profile-visibility" {...form.register('profileVisibility')}>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="theme-preference">Theme preference</label>
        <select id="theme-preference" {...form.register('themePreference')}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      {Object.keys(form.formState.errors).length > 0 && (
        <p className="form-error full">Check the highlighted fields.</p>
      )}
      {message && (
        <p className={`full ${message === 'Settings saved.' ? 'form-success' : 'form-error'}`} role="status">{message}</p>
      )}
      <div className="full">
        <button className="button button-primary" disabled={busy || preparing}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}
