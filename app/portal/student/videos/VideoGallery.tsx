"use client"

import { useState } from "react"
import Link from "next/link"

interface VideoProject {
  id: string
  title: string
  description: string
  video_url: string
  category: string
  status: string
  created_at: string
  thumbnail_url: string | null
}

// ── Platform detection + embed URL resolver ───────────────────────────────────

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    // YouTube standard: youtube.com/watch?v=ID
    if (host === 'youtube.com' && u.pathname === '/watch') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`
    }

    // YouTube short URL: youtu.be/ID
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    }

    // YouTube Shorts: youtube.com/shorts/ID
    if (host === 'youtube.com' && u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/shorts/')[1]?.split('/')[0]
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    }

    // YouTube embed already
    if (host === 'youtube.com' && u.pathname.startsWith('/embed/')) {
      return url
    }

    // TikTok: tiktok.com/@user/video/ID
    if (host === 'tiktok.com') {
      const m = u.pathname.match(/\/video\/(\d+)/)
      if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`
    }

    // Instagram Reels/Posts: instagram.com/reel/CODE or instagram.com/p/CODE
    if (host === 'instagram.com') {
      const m = u.pathname.match(/\/(reel|p)\/([^/]+)/)
      if (m) return `https://www.instagram.com/p/${m[2]}/embed`
    }

    // Facebook video: facebook.com/watch/?v=ID or facebook.com/.../videos/ID
    if (host === 'facebook.com' || host === 'fb.watch') {
      const encoded = encodeURIComponent(url)
      return `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=0&autoplay=1`
    }

    // Google Drive: drive.google.com/file/d/ID/view
    if (host === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
    }

    return null
  } catch {
    return null
  }
}

function getPlatformLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube'
    if (host === 'tiktok.com') return 'TikTok'
    if (host === 'instagram.com') return 'Instagram'
    if (host === 'facebook.com' || host === 'fb.watch') return 'Facebook'
    if (host === 'drive.google.com') return 'Google Drive'
    return 'Video'
  } catch {
    return 'Video'
  }
}

function getPlatformColor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be') return 'bg-[#FEE2E2] text-[#DC2626]'
    if (host === 'tiktok.com') return 'bg-[#0F172A] text-white'
    if (host === 'instagram.com') return 'bg-pink-100 text-pink-700'
    if (host === 'facebook.com' || host === 'fb.watch') return 'bg-[#EFF6FF] text-[#1D4ED8]'
    if (host === 'drive.google.com') return 'bg-[#E7F8EE] text-[#15803D]'
    return 'bg-[#F1F5F9] text-[#334155]'
  } catch {
    return 'bg-[#F1F5F9] text-[#334155]'
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending_review:   { label: 'Pending Review', cls: 'bg-[#FFFBEB] text-[#B45309]' },
  approved:         { label: 'Approved',        cls: 'bg-[#E7F8EE] text-[#15803D]' },
  featured:         { label: 'Featured',        cls: 'bg-purple-100 text-purple-700' },
  needs_improvement:{ label: 'Needs Work',      cls: 'bg-orange-100 text-orange-700' },
}

// ── Video card ────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  onPlay,
}: {
  video: VideoProject
  onPlay: (video: VideoProject) => void
}) {
  const platform = getPlatformLabel(video.video_url)
  const platformCls = getPlatformColor(video.video_url)
  const status = STATUS_LABEL[video.status] ?? { label: video.status, cls: 'bg-[#F1F5F9] text-[#475569]' }

  return (
    <div className="group overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition hover:shadow-md">
      {/* Thumbnail / play button */}
      <button
        onClick={() => onPlay(video)}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[#0B1F3A]/5 transition hover:bg-[#0B1F3A]/10"
        aria-label={`Play ${video.title}`}
      >
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl opacity-40">🎬</span>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg opacity-0 transition group-hover:opacity-100">
            <svg viewBox="0 0 20 20" fill="#0B1F3A" className="h-5 w-5 translate-x-0.5">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        </div>
      </button>

      <div className="p-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${platformCls}`}>
            {platform}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
            {status.label}
          </span>
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] text-[#64748B]">
            {video.category}
          </span>
        </div>
        <p className="line-clamp-1 text-[13px] font-semibold text-[#0B1F3A]">{video.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[#64748B]">{video.description}</p>
      </div>
    </div>
  )
}

// ── Video modal ───────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
}: {
  video: VideoProject
  onClose: () => void
}) {
  const embedUrl = getEmbedUrl(video.video_url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0B1F3A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{video.title}</p>
            <p className="text-[10px] text-white/40">{getPlatformLabel(video.video_url)} · {video.category}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Video embed */}
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-white/60">Cannot embed this video platform.</p>
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-[#FF8A1F] hover:underline"
                >
                  Open video in new tab →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="line-clamp-2 text-[11px] text-white/50">{video.description}</p>
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-[#FF8A1F] hover:underline"
          >
            Open original →
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoGallery({ videos }: { videos: VideoProject[] }) {
  const [activeVideo, setActiveVideo] = useState<VideoProject | null>(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-bold text-[#0B1F3A]">My Videos</h1>
          <p className="mt-0.5 text-[11.5px] text-[#64748B]">
            {videos.length} video{videos.length !== 1 ? 's' : ''} shared
            {videos.length > 0 && ' · +150 XP each'}
          </p>
        </div>
        <Link
          href="/portal/student/portfolio"
          className="rounded-xl bg-[#FF8A1F] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-[#e87a10]"
        >
          + Add Video
        </Link>
      </div>

      {/* XP tip banner */}
      {videos.length === 0 && (
        <div className="rounded-xl border border-[#FFD166]/40 bg-[#FFF7E6] px-4 py-3.5">
          <p className="text-[12.5px] font-semibold text-[#B45309]">🎥 Share your first video and earn 150 XP!</p>
          <p className="mt-0.5 text-[11px] text-[#92400E]">
            Add a YouTube, TikTok, Instagram, or Google Drive link to any portfolio project.
          </p>
        </div>
      )}

      {/* Grid */}
      {videos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={setActiveVideo} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] py-16 text-center">
          <p className="text-4xl">🎬</p>
          <p className="mt-3 text-sm font-semibold text-[#0B1F3A]">No videos yet</p>
          <p className="mt-1 text-[12px] text-[#94A3B8]">Add a video URL to any portfolio project to see it here.</p>
          <Link
            href="/portal/student/portfolio"
            className="mt-4 inline-block rounded-xl bg-[#FF8A1F] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#e87a10]"
          >
            Go to Portfolio
          </Link>
        </div>
      )}

      {/* Supported platforms note */}
      {videos.length > 0 && (
        <p className="text-center text-[10.5px] text-[#94A3B8]">
          Supports YouTube · TikTok · Instagram · Facebook · Google Drive
        </p>
      )}

      {/* Video modal */}
      {activeVideo && (
        <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  )
}
