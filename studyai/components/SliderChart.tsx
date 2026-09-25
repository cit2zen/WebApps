'use client'
import { useEffect, useRef, useState } from 'react'
import type { ChartConfig } from '@/lib/types'
import styles from './SliderChart.module.css'

interface Props {
  chartConfig: ChartConfig
}

export default function SliderChart({ chartConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<unknown>(null)
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(chartConfig.sliders.map(s => [s.variable, s.default]))
  )

  useEffect(() => {
    let destroyed = false

    async function initChart() {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      if (!canvasRef.current || destroyed) return

      if (chartRef.current) {
        (chartRef.current as InstanceType<typeof Chart>).destroy()
      }

      // Polaroid palette from the design tokens (canvas cannot read CSS vars directly)
      const css = getComputedStyle(document.documentElement)
      const tok = (name: string) => css.getPropertyValue(name).trim()
      const inkMuted = tok('--ink-muted')
      Chart.defaults.color = inkMuted
      Chart.defaults.borderColor = tok('--rule-color')
      Chart.defaults.font.family = tok('--font-body') || Chart.defaults.font.family
      const palette = ['--gold-dark', '--pol-info', '--pol-ok', '--pol-danger', '--ink-mid'].map(tok)

      // Deep clone config and inject current slider values into labels/title
      const config = JSON.parse(JSON.stringify(chartConfig.config)) as any

      // Datasets the model left uncoloured get the paper palette (explicit colours are kept)
      const datasets = config.data?.datasets
      if (Array.isArray(datasets)) {
        datasets.forEach((ds: Record<string, unknown>, i: number) => {
          const c = palette[i % palette.length]
          if (ds.borderColor === undefined) ds.borderColor = c
          if (ds.backgroundColor === undefined && !ds.fill) ds.backgroundColor = c
          if (ds.pointBackgroundColor === undefined) ds.pointBackgroundColor = c
        })
      }

      // Inject slider values into chart: update title to show current variable values
      const sliderSummary = chartConfig.sliders
        .map(s => `${s.variable}=${values[s.variable]?.toFixed(1) ?? s.default}`)
        .join(', ')
      if (config.options?.plugins?.title) {
        config.options.plugins.title.text = sliderSummary
      } else {
        config.options = config.options ?? {}
        config.options.plugins = config.options.plugins ?? {}
        config.options.plugins.title = { display: true, text: sliderSummary, color: inkMuted, font: { size: 11 } }
      }

      chartRef.current = new Chart(canvasRef.current, config)
    }

    initChart()
    return () => {
      destroyed = true
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy()
        chartRef.current = null
      }
    }
  }, [chartConfig, values])

  return (
    <div className={styles.wrap}>
      <div className={styles.chartArea}>
        <canvas ref={canvasRef} />
      </div>
      {chartConfig.sliders.map(slider => (
        <div key={slider.variable} className={styles.sliderRow}>
          <label className={styles.varLabel}>{slider.variable}</label>
          <input
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={values[slider.variable] ?? slider.default}
            onChange={e => setValues(v => ({ ...v, [slider.variable]: Number(e.target.value) }))}
            className={styles.slider}
          />
          <span className={styles.value}>{values[slider.variable]?.toFixed(1) ?? slider.default}</span>
        </div>
      ))}
    </div>
  )
}
