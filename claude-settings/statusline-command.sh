#!/bin/sh
# Claude Code status line script — colorful with Unicode gauge bars
# Layout: 󰊢project(branch) | model | ctx gauge | 5h gauge | 7d gauge | vim mode

input=$(cat)

# ── ANSI color helpers ──────────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

FG_BLUE='\033[38;5;75m'      # sky blue   – project/branch
FG_YELLOW='\033[38;5;220m'   # gold       – model name
FG_CYAN='\033[38;5;87m'      # bright cyan – ctx label
FG_GREEN='\033[38;5;120m'    # soft green  – gauge filled (low usage)
FG_ORANGE='\033[38;5;208m'   # orange      – gauge filled (medium usage)
FG_RED='\033[38;5;203m'      # coral red   – gauge filled (high usage)
FG_GRAY='\033[38;5;240m'     # dark gray   – gauge empty slots / separators
FG_PURPLE='\033[38;5;183m'   # lavender    – vim mode
FG_WHITE='\033[38;5;252m'    # off-white   – labels and separators

SEP="${FG_GRAY}│${RESET}"

build_gauge() {
  pct="$1"
  total="$2"

  filled=$(echo "$pct $total" | awk '{f=int($1*$2/100 + 0.5); if(f>$2) f=$2; print f}')
  empty=$(( total - filled ))

  if [ "$filled" -ge $(( total * 80 / 100 )) ]; then
    fill_color="$FG_RED"
  elif [ "$filled" -ge $(( total * 50 / 100 )) ]; then
    fill_color="$FG_ORANGE"
  else
    fill_color="$FG_GREEN"
  fi

  gauge_str="${fill_color}"
  i=0
  while [ "$i" -lt "$filled" ]; do
    gauge_str="${gauge_str}▓"
    i=$(( i + 1 ))
  done

  gauge_str="${gauge_str}${FG_GRAY}"
  i=0
  while [ "$i" -lt "$empty" ]; do
    gauge_str="${gauge_str}░"
    i=$(( i + 1 ))
  done

  gauge_str="${gauge_str}${RESET}"
  printf '%s' "$gauge_str"
}

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
cli_version=$(echo "$input" | jq -r '.version // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')

dir=""
if [ -n "$cwd" ]; then
  dir=$(basename "$cwd")
fi

branch=""
if [ -n "$cwd" ] && [ -d "$cwd/.git" ]; then
  branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)
fi

output=""

if [ -n "$dir" ]; then
  if [ -n "$branch" ]; then
    project_str="${FG_BLUE}${BOLD} ${dir}${RESET}${FG_GRAY}(${RESET}${FG_BLUE}${branch}${RESET}${FG_GRAY})${RESET}"
  else
    project_str="${FG_BLUE}${BOLD} ${dir}${RESET}"
  fi
  output="${project_str}"
fi

if [ -n "$model" ]; then
  if [ -n "$cli_version" ]; then
    model_str="${FG_YELLOW}⬡ ${model}${RESET} ${FG_GRAY}v${cli_version}${RESET}"
  else
    model_str="${FG_YELLOW}⬡ ${model}${RESET}"
  fi
  if [ -n "$output" ]; then
    output="${output}  ${SEP}  ${model_str}"
  else
    output="${model_str}"
  fi
fi

line2=""

if [ -n "$used_pct" ]; then
  used_int=$(printf '%.0f' "$used_pct")
  gauge=$(build_gauge "$used_pct" 10)
  ctx_str="${FG_CYAN}ctx${RESET} ${gauge} ${FG_WHITE}${used_int}%${RESET}"
else
  ctx_str="${FG_CYAN}ctx${RESET} ${FG_GRAY}░░░░░░░░░░${RESET} ${FG_GRAY} ─%${RESET}"
fi
line2="${ctx_str}"

if [ -n "$five_pct" ]; then
  five_int=$(printf '%.0f' "$five_pct")
  [ "$five_int" -gt 100 ] && five_int=100
  five_gauge=$(build_gauge "$five_pct" 8)
  five_remain=""
  if [ -n "$five_reset" ]; then
    now=$(date +%s)
    left=$((five_reset - now))
    if [ "$left" -gt 0 ]; then
      h=$((left / 3600))
      m=$(((left % 3600) / 60))
      five_remain=" ${FG_GRAY}${h}h${m}m${RESET}"
    fi
  fi
  rate_str="${FG_WHITE}5h${RESET} ${five_gauge} ${FG_WHITE}${five_int}%${RESET}${five_remain}"
else
  rate_str="${FG_WHITE}5h${RESET} ${FG_GRAY}░░░░░░░░${RESET} ${FG_GRAY} ─%${RESET}"
fi
line2="${line2}  ${SEP}  ${rate_str}"

if [ -n "$week_pct" ]; then
  week_int=$(printf '%.0f' "$week_pct")
  [ "$week_int" -gt 100 ] && week_int=100
  week_gauge=$(build_gauge "$week_pct" 8)
  week_remain=""
  if [ -n "$week_reset" ]; then
    now=${now:-$(date +%s)}
    left=$((week_reset - now))
    if [ "$left" -gt 0 ]; then
      d=$((left / 86400))
      h=$(((left % 86400) / 3600))
      if [ "$d" -gt 0 ]; then
        week_remain=" ${FG_GRAY}${d}d${h}h${RESET}"
      else
        m=$(((left % 3600) / 60))
        week_remain=" ${FG_GRAY}${h}h${m}m${RESET}"
      fi
    fi
  fi
  week_str="${FG_WHITE}7d${RESET} ${week_gauge} ${FG_WHITE}${week_int}%${RESET}${week_remain}"
else
  week_str="${FG_WHITE}7d${RESET} ${FG_GRAY}░░░░░░░░${RESET} ${FG_GRAY} ─%${RESET}"
fi
line2="${line2}  ${week_str}"

if [ -n "$vim_mode" ]; then
  case "$vim_mode" in
    INSERT) mode_color="$FG_GREEN" ; mode_icon="✎" ;;
    NORMAL) mode_color="$FG_BLUE"  ; mode_icon="●" ;;
    *)      mode_color="$FG_GRAY"  ; mode_icon="◌" ;;
  esac
  vim_str="${mode_color}${BOLD}${mode_icon} ${vim_mode}${RESET}"
  if [ -n "$line2" ]; then
    line2="${line2}  ${SEP}  ${vim_str}"
  else
    line2="${vim_str}"
  fi
fi

printf '%b\n%b' "$output" "$line2"
