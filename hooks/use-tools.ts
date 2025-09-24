"use client"

import { toast } from "sonner"
import confetti from 'canvas-confetti'
import { animate as framerAnimate } from "framer-motion"
import { useTranslations } from "@/context/translations-context"
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

export const useToolsFunctions = () => {
  const { t } = useTranslations();

  const timeFunction = () => {
    const now = new Date()
    return {
      success: true,
      time: now.toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      message: t('tools.time') + now.toLocaleTimeString() + " in " + Intl.DateTimeFormat().resolvedOptions().timeZone + " timezone."
    }
  }

  const backgroundFunction = () => {
    try {
      const html = document.documentElement;
      const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      html.classList.remove(currentTheme);
      html.classList.add(newTheme);

      toast(`Switched to ${newTheme} mode! 🌓`, {
        description: t('tools.switchTheme') + newTheme + ".",
      })

      return { 
        success: true, 
        theme: newTheme,
        message: t('tools.switchTheme') + newTheme + "."
      };
    } catch (error) {
      return { 
        success: false, 
        message: t('tools.themeFailed') + ": " + error 
      };
    }
  }

  const partyFunction = () => {
    try {
      const duration = 5 * 1000
      const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1", "#3b82f6", "#14b8a6", "#f97316", "#10b981", "#facc15"]
      
      const confettiConfig = {
        particleCount: 30,
        spread: 100,
        startVelocity: 90,
        colors,
        gravity: 0.5
      }

      const shootConfetti = (angle: number, origin: { x: number, y: number }) => {
        confetti({
          ...confettiConfig,
          angle,
          origin
        })
      }

      const animate = () => {
        const now = Date.now()
        const end = now + duration
        
        const elements = document.querySelectorAll('div, p, button, h1, h2, h3')
        elements.forEach((element) => {
          framerAnimate(element, 
            { 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }, 
            { 
              duration: 0.5,
              repeat: 10,
              ease: "easeInOut"
            }
          )
        })

        const frame = () => {
          if (Date.now() > end) return
          shootConfetti(60, { x: 0, y: 0.5 })
          shootConfetti(120, { x: 1, y: 0.5 })
          requestAnimationFrame(frame)
        }

        const mainElement = document.querySelector('main')
        if (mainElement) {
          mainElement.classList.remove('bg-gradient-to-b', 'from-gray-50', 'to-white')
          const originalBg = mainElement.style.backgroundColor
          
          const changeColor = () => {
            const now = Date.now()
            const end = now + duration
            
            const colorCycle = () => {
              if (Date.now() > end) {
                framerAnimate(mainElement, 
                  { backgroundColor: originalBg },
                  { duration: 0.5 }
                )
                return
              }
              const newColor = colors[Math.floor(Math.random() * colors.length)]
              framerAnimate(mainElement,
                { backgroundColor: newColor },
                { duration: 0.2 }
              )
              setTimeout(colorCycle, 200)
            }
            
            colorCycle()
          }
          
          changeColor()
        }
        
        frame()
      }

      animate()
      toast.success(t('tools.partyMode.toast') + " 🎉", {
        description: t('tools.partyMode.description'),
      })
      return { success: true, message: t('tools.partyMode.success') + " 🎉" }
    } catch (error) {
      return { success: false, message: t('tools.partyMode.failed') + ": " + error }
    }
  }

 const launchWebsite = ({ url }: { url: string }) => {
    try {
      // Ensure the URL is valid and properly formatted
      const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

      // Attempt to open the URL in a new tab
      const newWindow = window.open(formattedUrl, '_blank');

      // Check if the window was blocked or failed to open
      if (!newWindow) {
        throw new Error('Window blocked or failed to open');
      }

      // Show success toast
      toast(t('tools.launchWebsite') + " 🌐", {
        description: t('tools.launchWebsiteSuccess') + formattedUrl + ", tell the user it's been launched.",
      });

      return {
        success: true,
        message: `Launched the site ${formattedUrl}, tell the user it's been launched.`,
      };
    } catch (error: any) {
      // Show error toast if window.open fails
      toast.error(t('tools.launchWebsiteError'), {
        description: `Failed to launch ${url}. Please check your pop-up blocker or URL validity.`,
      });

      return {
        success: false,
        message: `Failed to launch the site ${url}: ${error.message}`,
      };
    }
  };

  const copyToClipboard = ({ text }: { text: string }) => {
    navigator.clipboard.writeText(text)
    toast(t('tools.clipboard.toast') + " 📋", {
      description: t('tools.clipboard.description'),
    })
    return {
      success: true,
      text,
      message: t('tools.clipboard.success')
    }
  }

  const scrapeWebsite = async ({ url }: { url: string }) => {
  const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
  try {
    // Show fetching toast message
    toast.loading(t('tools.scrapeWebsite.fetching'), {
      id: 'scrape-loading', // Unique ID to manage the toast
    });

    const app = new FirecrawlApp({ apiKey: apiKey });
    const scrapeResult = await app.scrapeUrl(url, { formats: ['markdown', 'html'] }) as ScrapeResponse;

    if (!scrapeResult.success) {
      // Dismiss the loading toast
      toast.dismiss('scrape-loading');
      console.log(scrapeResult.error);
      return {
        success: false,
        message: `Failed to scrape: ${scrapeResult.error}`,
      };
    }

    // Dismiss the loading toast and show success toast
    toast.dismiss('scrape-loading');
    toast.success(t('tools.scrapeWebsite.toast'), {
      description: t('tools.scrapeWebsite.success'),
    });

    return {
      success: true,
      message: `Here is the scraped website content: ${JSON.stringify(scrapeResult.markdown)} Summarize and explain it to the user now in a response.`,
    };
  } catch (error) {
    // Dismiss the loading toast on error
    toast.dismiss('scrape-loading');
    return {
      success: false,
      message: `Error scraping website: ${error}`,
    };
  }
};

  return {
    timeFunction,
    backgroundFunction,
    partyFunction,
    launchWebsite,
    copyToClipboard,
    scrapeWebsite
  }
}