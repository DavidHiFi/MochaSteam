local ffi = require('ffi')
local millennium = require('millennium')
local logger = require('logger')
ffi.cdef[[
void* FindWindowA(const char*, const char*);
unsigned long GetWindowThreadProcessId(void*, unsigned long*);
void* OpenProcess(unsigned long, int, unsigned long);
int QueryFullProcessImageNameA(void*, unsigned long, char*, unsigned long*);
int CloseHandle(void*);
typedef struct { int state; int flags; unsigned long color; int animation; } MochaAccent;
typedef struct { int attribute; void* data; size_t size; } MochaComposition;
int SetWindowCompositionAttribute(void*, MochaComposition*);
long DwmSetWindowAttribute(void*, unsigned long, const void*, unsigned long);
void* FindWindowExA(void*, void*, const char*, const char*);
typedef struct { int left; int right; int top; int bottom; } MochaMargins;
long DwmExtendFrameIntoClientArea(void*, const MochaMargins*);
typedef struct { long left; long top; long right; long bottom; } MochaRect;
int GetWindowRect(void*, MochaRect*);
int GetWindowTextLengthA(void*);
]]
local user32 = ffi.load('user32')
local kernel32 = ffi.load('kernel32')
local dwmapi = ffi.load('dwmapi')

-- Steam names each toast window notificationtoasts_<notificationID>_desktop, so the
-- frontend passes the real name. Only that window family is accepted.
function apply_notification_material(name)
    name = type(name) == 'string' and name or 'notificationtoasts_undefined_desktop'
    if not name:match('^notificationtoasts_[%w%-]+_desktop$') then return false end
    local hwnd = user32.FindWindowA(nil, name)
    if hwnd == nil then return false end
    local pid = ffi.new('unsigned long[1]')
    user32.GetWindowThreadProcessId(hwnd, pid)
    local process = kernel32.OpenProcess(0x1000, 0, pid[0])
    if process == nil then return false end
    local path = ffi.new('char[32768]')
    local size = ffi.new('unsigned long[1]', 32768)
    local queried = kernel32.QueryFullProcessImageNameA(process, 0, path, size)
    kernel32.CloseHandle(process)
    if queried == 0 or not ffi.string(path):lower():match('\\steamwebhelper%.exe$') then return false end
    -- Mocha base #1E1E2E at 68% (rice toast recipe). 85% read as flat colour.
    local accent = ffi.new('MochaAccent[1]', {{4, 0x20, 0xAD2E1E1E, 0}})
    local composition = ffi.new('MochaComposition', {19, accent, ffi.sizeof(accent[0])})
    local applied = user32.SetWindowCompositionAttribute(hwnd, composition) ~= 0
    if applied then
        local corner = ffi.new('int[1]', 2)
        local border = ffi.new('unsigned long[1]', 0xFFFFFFFE)
        dwmapi.DwmSetWindowAttribute(hwnd, 33, corner, 4)
        dwmapi.DwmSetWindowAttribute(hwnd, 34, border, 4)
        logger:info('Applied native acrylic to Steam desktop notification')
    end
    return applied
end

local function is_steam_helper(hwnd)
    local pid = ffi.new('unsigned long[1]')
    user32.GetWindowThreadProcessId(hwnd, pid)
    local process = kernel32.OpenProcess(0x1000, 0, pid[0])
    if process == nil then return false end
    local path = ffi.new('char[32768]')
    local size = ffi.new('unsigned long[1]', 32768)
    local queried = kernel32.QueryFullProcessImageNameA(process, 0, path, size)
    kernel32.CloseHandle(process)
    return queried ~= 0 and ffi.string(path):lower():match('\\steamwebhelper%.exe$') ~= nil
end

-- Pop-up menus are their own windows, so CSS blur inside them only sees the menu
-- itself. Windows acrylic on the window frosts whatever is behind it: the Steam
-- page or the desktop. Tint: Mocha base #1E1E2E at 85%, the same recipe as the desktop
-- menus (seamless-flyouts). 60% mantle let colour shapes read through (owner, 2026-11-23).
local MENU_TINT = 0xD82E1E1E
local function frost_menu(hwnd)
    local accent = ffi.new('MochaAccent[1]', {{4, 0x20, MENU_TINT, 0}})
    local composition = ffi.new('MochaComposition', {19, accent, ffi.sizeof(accent[0])})
    if user32.SetWindowCompositionAttribute(hwnd, composition) == 0 then return false end
    local corner = ffi.new('int[1]', 2)
    local border = ffi.new('unsigned long[1]', 0xFFFFFFFE)
    dwmapi.DwmSetWindowAttribute(hwnd, 33, corner, 4)
    dwmapi.DwmSetWindowAttribute(hwnd, 34, border, 4)
    return true
end
function apply_menu_material(title)
    if type(title) ~= 'string' then return false end
    if not (title == 'Menu' or title:match('^[%w ]+ Menu$') or title:match('^[%w ]+ Supernav$')) then
        return false
    end
    local applied = false
    local hwnd = user32.FindWindowExA(nil, nil, nil, title)
    while hwnd ~= nil do
        if is_steam_helper(hwnd) and frost_menu(hwnd) then applied = true end
        hwnd = user32.FindWindowExA(nil, hwnd, nil, title)
    end
    return applied
end

-- The menu bar menus (Steam, View, Friends...) have no window title, so the
-- frontend passes the menu's screen box as "x,y,width,height" instead. Only an
-- untitled Steam pop-up window at exactly that box is frosted.
function apply_menu_material_at(rect)
    if type(rect) ~= 'string' then return false end
    local x, y, w, h = rect:match('^(%-?%d+),(%-?%d+),(%d+),(%d+)$')
    if not x then return false end
    x, y, w, h = tonumber(x), tonumber(y), tonumber(w), tonumber(h)
    if w < 8 or h < 8 then return false end
    local applied = false
    local box = ffi.new('MochaRect')
    local hwnd = user32.FindWindowExA(nil, nil, 'SDL_app', nil)
    while hwnd ~= nil do
        if user32.GetWindowTextLengthA(hwnd) == 0 and user32.GetWindowRect(hwnd, box) ~= 0
            and box.left == x and box.top == y and box.right - box.left == w and box.bottom - box.top == h
            and is_steam_helper(hwnd) and frost_menu(hwnd) then
            applied = true
        end
        hwnd = user32.FindWindowExA(nil, hwnd, 'SDL_app', nil)
    end
    return applied
end

-- The title bar: the title bar mod paints every caption Mocha base, which reads as a
-- flat strip over the frosted window. Extending the frame over the whole window and
-- clearing the caption colour lets the caption show the same glass as the body.
-- The mod repaints on every focus change, so the frontend calls this after each one.
function apply_main_window_material()
    local hwnd = user32.FindWindowA('SDL_app', 'Steam')
    if hwnd == nil or not is_steam_helper(hwnd) then return false end
    local margins = ffi.new('MochaMargins', {-1, -1, -1, -1})
    local none = ffi.new('unsigned long[1]', 0xFFFFFFFE)
    local extended = dwmapi.DwmExtendFrameIntoClientArea(hwnd, margins) == 0
    local cleared = dwmapi.DwmSetWindowAttribute(hwnd, 35, none, 4) == 0
    return extended and cleared
end

-- Small windows (game properties, settings, dialogs) get the same glass caption as the
-- main window. The frontend passes the window's own title; only Steam windows with
-- exactly that title are touched.
function apply_window_material(title)
    if type(title) ~= 'string' or title == '' or #title > 260 or title == 'Steam' then return false end
    local margins = ffi.new('MochaMargins', {-1, -1, -1, -1})
    local none = ffi.new('unsigned long[1]', 0xFFFFFFFE)
    local applied = false
    local hwnd = user32.FindWindowExA(nil, nil, 'SDL_app', title)
    while hwnd ~= nil do
        if is_steam_helper(hwnd)
            and dwmapi.DwmExtendFrameIntoClientArea(hwnd, margins) == 0
            and dwmapi.DwmSetWindowAttribute(hwnd, 35, none, 4) == 0 then
            applied = true
        end
        hwnd = user32.FindWindowExA(nil, hwnd, 'SDL_app', title)
    end
    return applied
end

return {
    on_load = function() millennium.ready() end,
    on_frontend_loaded = function() end,
    on_unload = function() end,
}
