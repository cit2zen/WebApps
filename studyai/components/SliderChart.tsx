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

      // Inject current slider values into chart config datasets
      const config = JSON.parse(JSON.stringify(chartConfig.config)) as Record<string, unknown>

      chartRef.current = new Chart(canvasRef.current, config as Parameters<typeof Chart>[1])
    }

    initChart()
    return () => {
      destroyed = true
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy()
        chartRef.current = null
      }
    }
  }, [chartConfig.config, values])

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
