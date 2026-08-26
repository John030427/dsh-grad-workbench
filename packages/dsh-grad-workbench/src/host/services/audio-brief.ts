/**
 * Audio brief — deterministic listening-script generation from a literature
 * report. TTS synthesis is behind a provider interface: when no provider is
 * configured the script is still produced (editable) and `audioAvailable` is
 * honestly false. Choosing/adding a TTS provider is a product decision that
 * requires user input (see PROGRESS.md known deferred items).
 */

import type { ArtifactStore } from './artifact-store.ts'

export interface TTSSynthesisProvider {
  readonly id: string
  synthesize(text: string): Promise<{ bytes: Uint8Array; mediaType: string }>
}

export class AudioBriefService {
  private readonly artifacts: ArtifactStore
  private readonly ttsProvider?: TTSSynthesisProvider

  constructor(artifacts: ArtifactStore, ttsProvider?: TTSSynthesisProvider) {
    this.artifacts = artifacts
    this.ttsProvider = ttsProvider
  }

  /** Turn report Markdown into a ~20-minute listening script. */
  generateScript(reportMarkdown: string): string {
    const lines = reportMarkdown.split('\n')
    const titleLine = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? 'Research update'
    const themeLines = lines.filter((l) => l.trim().startsWith('- ') && l.includes('Theme')).slice(0, 6)
    const readFirstIdx = lines.indexOf('## 9. What to read first')
    const readFirst = readFirstIdx >= 0 ? lines.slice(readFirstIdx + 1).filter((l) => /^\d+\./.test(l)).slice(0, 3) : []

    const sections: string[] = []
    sections.push(`[00:00] 开场：${titleLine}。本期用大约二十分钟，带你了解这个方向最近值得关注的论文。`)
    sections.push('[01:00] 范围与方法：以下内容基于公开元数据与摘要整理，所有结论都标注了证据级别，未阅读全文的部分会明确说明。')

    if (themeLines.length > 0) {
      sections.push('[03:00] 主要主题：')
      for (const t of themeLines) sections.push(`  · ${t.replace(/^- /, '').replace(/\*\*/g, '')}`)
    }

    if (readFirst.length > 0) {
      sections.push('[15:00] 建议优先阅读：')
      for (const r of readFirst) sections.push(`  · ${r.replace(/^\d+\.\s*/, '')}`)
    }

    sections.push('[18:00] 研究空白：完整的方法论对比需要全文证据，本脚本仅给出主题覆盖度信号。')
    sections.push('[19:30] 结尾：以上论文列表与引用来源见配套的文字报告。')

    return sections.join('\n\n')
  }

  async createBrief(input: { reportArtifactId: string }): Promise<{
    scriptArtifactId: string
    audioAvailable: boolean
    audioArtifactId?: string
  }> {
    const { text } = this.artifacts.readText(input.reportArtifactId)
    const script = this.generateScript(text)
    const scriptRef = this.artifacts.put({
      kind: 'audio-script',
      mediaType: 'text/markdown',
      bytes: script,
      sourceRefs: [
        {
          id: `report-${input.reportArtifactId}`,
          kind: 'artifact',
          ref: input.reportArtifactId,
          title: 'Source research report',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    if (!this.ttsProvider) {
      return { scriptArtifactId: scriptRef.id, audioAvailable: false }
    }
    const synth = await this.ttsProvider.synthesize(script)
    const audioRef = this.artifacts.put({
      kind: 'audio-file',
      mediaType: synth.mediaType,
      bytes: synth.bytes,
    })
    return { scriptArtifactId: scriptRef.id, audioAvailable: true, audioArtifactId: audioRef.id }
  }
}
