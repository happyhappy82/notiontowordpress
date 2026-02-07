// 기존 aijeong.com WP 포스트에서 추출한 인라인 스타일 상수

export const STYLES = {
  image: {
    wrapper: 'style="text-align:center;margin:1.5rem 0;"',
    img: 'class="max-w-full h-auto rounded-md" style="max-width:100%;height:auto;display:block;margin:1rem auto;"',
  },

  table: {
    table: 'style="border-collapse:collapse;border:1px solid #ddd;max-width:100%;width:100%;margin:1rem 0;"',
    headerRow: 'style="background-color:#e2fffb;"',
    headerCell: 'style="border:1px solid #ddd;padding:8px 12px;font-weight:bold;text-align:left;"',
    cell: 'style="border:1px solid #ddd;padding:8px 12px;text-align:left;"',
  },

  callout: {
    wrapper: 'style="margin:15px 0;padding:15px;border:1px solid #ddd;border-radius:8px;background-color:#f9f9f9;"',
    icon: 'style="margin-right:8px;font-size:1.2em;"',
    content: 'style="display:inline;"',
  },

  quote: {
    wrapper: 'style="border-left:3px solid #e2fffb;padding:10px 20px;margin:1rem 0;background-color:#f9f9f9;"',
  },

  divider: {
    hr: 'style="border:none;border-top:1px solid #ddd;margin:2rem 0;"',
  },

  code: {
    pre: 'style="background-color:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px;overflow-x:auto;margin:1rem 0;font-family:monospace;font-size:14px;line-height:1.5;"',
  },

  toggle: {
    details: 'style="margin:1rem 0;border:1px solid #ddd;border-radius:8px;overflow:hidden;"',
    summary: 'style="padding:12px 16px;cursor:pointer;font-weight:bold;background-color:#f5f5f5;"',
    content: 'style="padding:12px 16px;"',
  },

  bookmark: {
    wrapper: 'style="margin:1rem 0;padding:12px 16px;border:1px solid #ddd;border-radius:8px;"',
    link: 'style="color:#0b6e99;text-decoration:none;"',
  },

  video: {
    wrapper: 'style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;"',
    iframe: 'style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allowfullscreen',
  },
} as const;
