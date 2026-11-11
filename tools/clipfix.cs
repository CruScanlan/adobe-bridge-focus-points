/*
 * clipfix.cs - NOT SHIPPED. A known remedy kept for the day it is needed.
 *
 * Bridge docks a CEP panel inside a "DroverLord - TabPanel Window" that is
 * created WITHOUT WS_CLIPCHILDREN, so every time Bridge repaints that window it
 * paints straight over the panel. A GPU-composited CEF panel is unaffected (its
 * frames are a separate DirectComposition surface above the window) and that is
 * how the extension runs by default. A SOFTWARE-composited one is wiped: the
 * panel is alive, laid out and correct, and the screen shows Bridge's flat
 * panel background. That happens if CEF is forced into software rendering with
 * --disable-gpu style flags, and may happen on machines where CEF falls back to
 * software by itself.
 *
 * This helper sets WS_CLIPCHILDREN on that one window and re-checks twice a
 * second, because Bridge builds a new tab panel whenever the panel is re-docked
 * or the workspace changes. Measured 2026-11-11 on Bridge 16.0.8 with the panel
 * in software mode: drawn in 0/12 samples without it, 12/12 with it.
 *
 * To use it again: build with the .NET Framework C# compiler (C# 5),
 *   csc -optimize+ -target:winexe -platform:x64 -out:clipfix.exe clipfix.cs
 * ship the exe in the extension, and spawn it from the panel's Node context
 * with the pid of the CEPHtmlEngine browser process (process.ppid there). It
 * exits when that process does.
 *
 * Usage: clipfix.exe <pid of the CEPHtmlEngine browser process>
 */
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class ClipFix
{
    const int GWL_STYLE = -16;
    const long WS_CLIPCHILDREN = 0x02000000L;
    const uint GA_ROOT = 2;
    // NOSIZE | NOMOVE | NOZORDER | NOACTIVATE | FRAMECHANGED
    const uint SWP_STYLE_CHANGED = 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020;
    // INVALIDATE | ALLCHILDREN
    const uint RDW_REPAINT_TREE = 0x0001 | 0x0080;
    const string PANEL_CONTAINER_CLASS = "WC_PLUGPLUG_HTMLEXTENSION_CLASS_NAME";
    const string CEF_WINDOW_CLASS = "CefBrowserWindow";

    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr hwnd, StringBuilder name, int max);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] static extern bool RedrawWindow(IntPtr hwnd, IntPtr rect, IntPtr region, uint flags);

    static string ClassOf(IntPtr hwnd)
    {
        StringBuilder name = new StringBuilder(128);
        GetClassNameW(hwnd, name, name.Capacity);
        return name.ToString();
    }

    /** The CEF window our engine process created inside Bridge, or Zero. */
    static IntPtr FindCefWindow(uint enginePid)
    {
        IntPtr found = IntPtr.Zero;
        EnumProc visitChild = delegate(IntPtr hwnd, IntPtr unused)
        {
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid != enginePid || ClassOf(hwnd) != CEF_WINDOW_CLASS) return true;
            found = hwnd;
            return false;
        };
        EnumWindows(delegate(IntPtr top, IntPtr unused)
        {
            EnumChildWindows(top, visitChild, IntPtr.Zero);
            return found == IntPtr.Zero;
        }, IntPtr.Zero);
        return found;
    }

    /** One pass: make the window Bridge docked us into clip its children. */
    static void Apply(uint enginePid)
    {
        IntPtr cef = FindCefWindow(enginePid);
        if (cef == IntPtr.Zero) return;   // not docked yet (or panel closed)

        // CefBrowserWindow -> PlugPlug's content window -> PlugPlug's container.
        IntPtr container = cef;
        for (int depth = 0; depth < 4 && container != IntPtr.Zero; depth++)
        {
            if (ClassOf(container) == PANEL_CONTAINER_CLASS) break;
            container = GetParent(container);
        }
        if (container == IntPtr.Zero || ClassOf(container) != PANEL_CONTAINER_CLASS) return;

        IntPtr dock = GetParent(container);
        if (dock == IntPtr.Zero || dock == GetAncestor(container, GA_ROOT)) return;

        long style = GetWindowLongPtr(dock, GWL_STYLE).ToInt64();
        if ((style & WS_CLIPCHILDREN) != 0) return;

        SetWindowLongPtr(dock, GWL_STYLE, new IntPtr(style | WS_CLIPCHILDREN));
        SetWindowPos(dock, IntPtr.Zero, 0, 0, 0, 0, SWP_STYLE_CHANGED);
        // Whatever Bridge already painted over stays wiped until CEF redraws.
        RedrawWindow(container, IntPtr.Zero, IntPtr.Zero, RDW_REPAINT_TREE);
    }

    static bool IsRunning(uint pid)
    {
        try { return !Process.GetProcessById((int)pid).HasExited; }
        catch (ArgumentException) { return false; }
        catch (InvalidOperationException) { return false; }
    }

    static int Main(string[] args)
    {
        uint enginePid;
        if (args.Length != 1 || !uint.TryParse(args[0], out enginePid)) return 2;

        while (IsRunning(enginePid))
        {
            try { Apply(enginePid); } catch (Exception) { /* keep watching */ }
            Thread.Sleep(500);
        }
        return 0;
    }
}
