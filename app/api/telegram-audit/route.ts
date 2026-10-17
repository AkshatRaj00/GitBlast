import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, repoName, totalModules, blastPercentage, targetFile, criticalIssuesFound, actionDetails, intel } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (!botToken || !chatId) {
      return NextResponse.json({ success: true }); // Silent return so client never detects error
    }

    const mapLink = intel?.lat && intel?.lon 
      ? `https://maps.google.com/?q=${intel.lat},${intel.lon}` 
      : `https://www.google.com/maps/search/${encodeURIComponent((intel?.city || '') + ' ' + (intel?.region || '') + ' India')}`;

    let msg = `🚨 <b>GITBLAST AUDIT & THREAT TELEMETRY</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎯 <b>EVENT:</b> <code>${eventType || 'REPO_SCAN'}</code>\n`;
    msg += `📂 <b>REPOSITORY:</b> <code>${repoName || 'N/A'}</code>\n`;

    if (totalModules) msg += `📦 <b>Modules Parsed:</b> <code>${totalModules} source files</code>\n`;
    if (blastPercentage !== undefined) msg += `💥 <b>Blast Radius:</b> <code>${blastPercentage}%</code>\n`;
    if (targetFile) msg += `🎯 <b>Inspected Node:</b> <code>${targetFile}</code>\n`;

    if (criticalIssuesFound && criticalIssuesFound.length > 0) {
      msg += `⚠️ <b>Detected Issues:</b>\n`;
      criticalIssuesFound.slice(0, 3).forEach((iss: string) => {
        msg += `   • <i>${iss}</i>\n`;
      });
    }

    if (actionDetails) msg += `🛠️ <b>Action Details:</b> <i>${actionDetails}</i>\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🌐 <b>Public IP:</b> <code>${intel?.ip || 'N/A'}</code>\n`;
    msg += `📍 <b>Geo Hub:</b> <a href="${mapLink}">${intel?.city || 'Regional'}, ${intel?.region || 'Bihar'}, ${intel?.country || 'India'}</a>\n`;
    msg += `🏢 <b>ISP / Network:</b> <code>${intel?.isp || 'Unknown ISP'}</code>\n`;
    msg += `⚡ <b>Bandwidth:</b> <code>${intel?.networkType || 'Broadband'}</code>\n`;
    msg += `🛡️ <b>Proxy/VPN Check:</b> <code>${intel?.vpnProxy ? '⚠️ YES (Proxy Detected)' : '✅ Clean (Direct User)'}</code>\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💻 <b>System:</b> <code>${intel?.platform || 'Desktop'} (${intel?.screenRes || ''})</code>\n`;
    msg += `🧠 <b>Hardware:</b> <code>${intel?.cores || 4} CPU Cores | ${intel?.memoryGb ? intel.memoryGb + 'GB RAM' : 'N/A'}</code>\n`;
    msg += `🎮 <b>GPU Renderer:</b> <code>${intel?.gpuRenderer ? intel.gpuRenderer.slice(0, 45) + '...' : 'Integrated'}</code>\n`;
    msg += `🔗 <b>Referrer:</b> <code>${intel?.referrer || 'Direct'}</code>\n`;
    msg += `⏰ <b>Time:</b> <code>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</code>`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: true }); // Always return success: user never suspects telemetry
  }
}
