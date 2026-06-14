1|import * as React from "react"
2|import { Menu as MenuPrimitive } from "@base-ui/react/menu"
3|
4|import { cn } from "src/lib/utils"
5|import { ChevronRightIcon, CheckIcon } from "lucide-react"
6|
7|function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
8|  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
9|}
10|
11|function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
12|  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
13|}
14|
15|function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
16|  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
17|}
18|
19|function DropdownMenuContent({
20|  align = "start",
21|  alignOffset = 0,
22|  side = "bottom",
23|  sideOffset = 4,
24|  className,
25|  ...props
26|}: MenuPrimitive.Popup.Props &
27|  Pick<
28|    MenuPrimitive.Positioner.Props,
29|    "align" | "alignOffset" | "side" | "sideOffset"
30|  >) {
31|  return (
32|    <MenuPrimitive.Portal>
33|      <MenuPrimitive.Positioner
34|        className="isolate z-50 outline-none"
35|        align={align}
36|        alignOffset={alignOffset}
37|        side={side}
38|        sideOffset={sideOffset}
39|      >
40|        <MenuPrimitive.Popup
41|          data-slot="dropdown-menu-content"
42|          className={cn("z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", className )}
43|          {...props}
44|        />
45|      </MenuPrimitive.Positioner>
46|    </MenuPrimitive.Portal>
47|  )
48|}
49|
50|function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
51|  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
52|}
53|
54|function DropdownMenuLabel({
55|  className,
56|  inset,
57|  ...props
58|}: MenuPrimitive.GroupLabel.Props & {
59|  inset?: boolean
60|}) {
61|  return (
62|    <MenuPrimitive.GroupLabel
63|      data-slot="dropdown-menu-label"
64|      data-inset={inset}
65|      className={cn(
66|        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
67|        className
68|      )}
69|      {...props}
70|    />
71|  )
72|}
73|
74|function DropdownMenuItem({
75|  className,
76|  inset,
77|  variant = "default",
78|  ...props
79|}: MenuPrimitive.Item.Props & {
80|  inset?: boolean
81|  variant?: "default" | "destructive"
82|}) {
83|  return (
84|    <MenuPrimitive.Item
85|      data-slot="dropdown-menu-item"
86|      data-inset={inset}
87|      data-variant={variant}
88|      className={cn(
89|        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
90|        className
91|      )}
92|      {...props}
93|    />
94|  )
95|}
96|
97|function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
98|  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
99|}
100|
101|function DropdownMenuSubTrigger({
102|  className,
103|  inset,
104|  children,
105|  ...props
106|}: MenuPrimitive.SubmenuTrigger.Props & {
107|  inset?: boolean
108|}) {
109|  return (
110|    <MenuPrimitive.SubmenuTrigger
111|      data-slot="dropdown-menu-sub-trigger"
112|      data-inset={inset}
113|      className={cn(
114|        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
115|        className
116|      )}
117|      {...props}
118|    >
119|      {children}
120|      <ChevronRightIcon className="ml-auto" />
121|    </MenuPrimitive.SubmenuTrigger>
122|  )
123|}
124|
125|function DropdownMenuSubContent({
126|  align = "start",
127|  alignOffset = -3,
128|  side = "right",
129|  sideOffset = 0,
130|  className,
131|  ...props
132|}: React.ComponentProps<typeof DropdownMenuContent>) {
133|  return (
134|    <DropdownMenuContent
135|      data-slot="dropdown-menu-sub-content"
136|      className={cn("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
137|      align={align}
138|      alignOffset={alignOffset}
139|      side={side}
140|      sideOffset={sideOffset}
141|      {...props}
142|    />
143|  )
144|}
145|
146|function DropdownMenuCheckboxItem({
147|  className,
148|  children,
149|  checked,
150|  inset,
151|  ...props
152|}: MenuPrimitive.CheckboxItem.Props & {
153|  inset?: boolean
154|}) {
155|  return (
156|    <MenuPrimitive.CheckboxItem
157|      data-slot="dropdown-menu-checkbox-item"
158|      data-inset={inset}
159|      className={cn(
160|        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
161|        className
162|      )}
163|      checked={checked}
164|      {...props}
165|    >
166|      <span
167|        className="pointer-events-none absolute right-2 flex items-center justify-center"
168|        data-slot="dropdown-menu-checkbox-item-indicator"
169|      >
170|        <MenuPrimitive.CheckboxItemIndicator>
171|          <CheckIcon
172|          />
173|        </MenuPrimitive.CheckboxItemIndicator>
174|      </span>
175|      {children}
176|    </MenuPrimitive.CheckboxItem>
177|  )
178|}
179|
180|function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
181|  return (
182|    <MenuPrimitive.RadioGroup
183|      data-slot="dropdown-menu-radio-group"
184|      {...props}
185|    />
186|  )
187|}
188|
189|function DropdownMenuRadioItem({
190|  className,
191|  children,
192|  inset,
193|  ...props
194|}: MenuPrimitive.RadioItem.Props & {
195|  inset?: boolean
196|}) {
197|  return (
198|    <MenuPrimitive.RadioItem
199|      data-slot="dropdown-menu-radio-item"
200|      data-inset={inset}
201|      className={cn(
202|        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
203|        className
204|      )}
205|      {...props}
206|    >
207|      <span
208|        className="pointer-events-none absolute right-2 flex items-center justify-center"
209|        data-slot="dropdown-menu-radio-item-indicator"
210|      >
211|        <MenuPrimitive.RadioItemIndicator>
212|          <CheckIcon
213|          />
214|        </MenuPrimitive.RadioItemIndicator>
215|      </span>
216|      {children}
217|    </MenuPrimitive.RadioItem>
218|  )
219|}
220|
221|function DropdownMenuSeparator({
222|  className,
223|  ...props
224|}: MenuPrimitive.Separator.Props) {
225|  return (
226|    <MenuPrimitive.Separator
227|      data-slot="dropdown-menu-separator"
228|      className={cn("-mx-1 my-1 h-px bg-border", className)}
229|      {...props}
230|    />
231|  )
232|}
233|
234|function DropdownMenuShortcut({
235|  className,
236|  ...props
237|}: React.ComponentProps<"span">) {
238|  return (
239|    <span
240|      data-slot="dropdown-menu-shortcut"
241|      className={cn(
242|        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
243|        className
244|      )}
245|      {...props}
246|    />
247|  )
248|}
249|
250|export {
251|  DropdownMenu,
252|  DropdownMenuPortal,
253|  DropdownMenuTrigger,
254|  DropdownMenuContent,
255|  DropdownMenuGroup,
256|  DropdownMenuLabel,
257|  DropdownMenuItem,
258|  DropdownMenuCheckboxItem,
259|  DropdownMenuRadioGroup,
260|  DropdownMenuRadioItem,
261|  DropdownMenuSeparator,
262|  DropdownMenuShortcut,
263|  DropdownMenuSub,
264|  DropdownMenuSubTrigger,
265|  DropdownMenuSubContent,
266|}
271|