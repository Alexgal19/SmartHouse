
"use client"

import * as React from "react"
import {
  Label,
  TooltipProps
} from "recharts"

import { cn } from "@/lib/utils"
import {
  Card
} from "@/components/ui/card"
import * as Recharts from 'recharts';


// #region Chart

export type ChartConfig = {
  [key in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & ({
    color?: string
    theme?: never
  } | {
    color?: never
    theme: {
      light: string
      dark: string
    }
  })
}



interface ChartContextProps {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    return null;
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: ChartConfig
    children: React.ReactNode
  }
>(({ id, className, children, config, ...props }, ref) => {
  const chartConfig = React.useMemo(
    () =>
      Object.entries(config).reduce(
        (prev, [key, value]) => {
          const newConfig = {
            ...prev,
            [key]: {
              ...value,
              color: value.theme
                ? `hsl(var(--chart-${key}))`
                : value.color,
            },
          }

          return newConfig
        },
        {} as ChartConfig
      ),
    [config]
  )

  return (
    <ChartContext.Provider value={{ config: chartConfig }}>
      <div
        ref={ref}
        id={id}
        data-chart={id}
        className={cn(
          "flex flex-col justify-between rounded-lg border",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({
  id,
  config,
}: {
  id: string
  config: ChartConfig
}) => {
  const root = React.useRef<HTMLStyleElement>(null)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useLayoutEffect(() => {
    setIsMounted(true)
  }, [])

  const style = React.useMemo(() => {
    return Object.entries(config)
      .map(([key, value]) => {
        const color =
          "theme" in value && value.theme
            ? `var(--${id}-${key}, ${value.theme.light})`
            : value.color;
        const darkColor = "theme" in value && value.theme ? value.theme.dark : color;

        return `
[data-chart=${id}] .chart-${key} {
  --color-primary: ${color};
}
.dark [data-chart=${id}] .chart-${key} {
  --color-primary: ${darkColor};
}
`
      })
      .join("\n")
  }, [config, id])

  if (!isMounted) {
    return null
  }

  return (
    <style
      ref={root}
      dangerouslySetInnerHTML={{
        __html: style,
      }}
    />
  )
}

const ChartLegend = Recharts.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<TooltipProps<any, any>, "payload"> & {
      hideIcon?: boolean
      getLabel?: (value: string) => React.ReactNode
    }
>(({ className, hideIcon, payload, getLabel, ...props }, ref) => {
  const { config } = useChart()!

  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", className)}
      {...props}
    >
      {payload.map((item: { value: any }) => {
        const key = `${item.value}`
        const entry = config[key]
        const color = entry?.color

        return (
          <div
            key={key}
            className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
          >
            {!hideIcon ? (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: color,
                }}
              />
            ) : null}
            {getLabel ? getLabel(key) : entry?.label}
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

// #endregion

// #region Tooltip
const ChartTooltip = Recharts.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    React.ComponentProps<typeof Recharts.Tooltip> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
      labelFormatter?: (label: any, payload: any[]) => React.ReactNode
      labelClassName?: string
      config?: ChartConfig
    }
>(
  (
    {
      active,
      payload,
      className,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
      labelFormatter,
      labelClassName,
      config: propConfig,
    },
    ref
  ) => {
    const context = useChart()
    const config = propConfig || context?.config || {}


    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey && item.payload ? item.payload[labelKey] : item.name}`

      if (labelFormatter) {
        return labelFormatter(key, payload)
      }

      return key
    }, [labelKey, payload, hideLabel, labelFormatter])

    if (!active || !payload?.length) {
      return null
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-stretch gap-1.5 rounded-md border bg-background/95 p-2.5 text-sm shadow-xl animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        {!hideLabel && tooltipLabel ? (
          <div className={cn("font-medium", labelClassName)}>
            {tooltipLabel}
          </div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, i) => {
            const key = `${nameKey && item.payload ? item.payload[nameKey] : item.name}`
            const entry = config[key]
            const color = entry?.color

            return (
              <div
                key={i}
                className="flex items-center gap-2 [&>svg]:h-3 [&>svg]:w-3"
              >
                {!hideIndicator ? (
                  <div
                    className={cn("h-2 w-2 shrink-0 rounded-[2px]", {
                      "bg-[--color-primary]": indicator === "dot",
                      "w-1": indicator === "line",
                      "w-0 border-[1.5px] border-dashed bg-transparent":
                        indicator === "dashed",
                      "h-2.5 w-2.5": indicator === "line",
                    })}
                    style={{
                      ["--color-primary" as any]: color,
                    }}
                  />
                ) : null}
                <div className="flex flex-1 justify-between">
                  <div className="text-muted-foreground">{entry?.label || key}</div>
                  <div>{`${"value" in item ? item.value : ''}`}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// #endregion

const ChartPie = (
  props: Recharts.PieProps & {
    active?: boolean
  }
) => {
  const { active, ...rest } = props
  const { config } = useChart()!
  const [activeIndex, setActiveIndex] = React.useState<number | null>(
    active ? 0 : null
  )

  const chartConfig = React.useMemo(
    () =>
      Object.keys(config).map((key) => {
        return {
          key,
          ...config[key],
        }
      }),
    [config]
  )

  const onPieEnter = React.useCallback(
    (_: unknown, index: number) => {
      setActiveIndex(index)
    },
    [setActiveIndex]
  )
  const onPieLeave = React.useCallback(() => {
    setActiveIndex(null)
  }, [setActiveIndex])

  return (
    <Recharts.Pie
      activeIndex={activeIndex ?? undefined}
      onMouseLeave={active ? onPieLeave : undefined}
      onMouseEnter={active ? onPieEnter : undefined}
      {...rest}
    >
      {props.data?.map((_, index) => (
        <Recharts.Cell
          key={`cell-${index}`}
          fill={chartConfig[index % chartConfig.length]?.color}
          style={
            {
              "--color-primary": chartConfig[index % chartConfig.length]?.color,
            } as React.CSSProperties
          }
        />
      ))}
      {active && <Recharts.Sector />}
      {rest.children}
    </Recharts.Pie>
  )
}
ChartPie.displayName = "ChartPie"

const PieLabel = (
  props: Recharts.LabelProps & {
    format?: (value: number) => string
  }
) => {
  return (
    <Label
      {...(props as any)}
      value={typeof props.value === "number" ? props.format?.(props.value) : props.value}
    />
  )
}

export {
  ChartContainer,
  ChartStyle,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartPie,
  PieLabel,
}

export const ResponsiveContainer = Recharts.ResponsiveContainer;
export const BarChart = Recharts.BarChart;
export const LineChart = Recharts.LineChart;
export const AreaChart = Recharts.AreaChart;
export const PieChart = Recharts.PieChart;
export const RadarChart = Recharts.RadarChart;
export const RadialBarChart = Recharts.RadialBarChart;
export const XAxis = Recharts.XAxis;
export const YAxis = Recharts.YAxis;
export const CartesianGrid = Recharts.CartesianGrid;
export const PolarGrid = Recharts.PolarGrid;
export const PolarAngleAxis = Recharts.PolarAngleAxis;
export const PolarRadiusAxis = Recharts.PolarRadiusAxis;
export const Bar = Recharts.Bar;
export const Line = Recharts.Line;
export const Area = Recharts.Area;
export const Cell = Recharts.Cell;
export const Legend = Recharts.Legend;
export const Sector = Recharts.Sector;
export const LabelList = Recharts.LabelList;
export const Pie = Recharts.Pie;
export const Radar = Recharts.Radar;
export const RadialBar = Recharts.RadialBar;
export { Tooltip as RechartsTooltip } from "recharts";

export type { ChartConfig }
