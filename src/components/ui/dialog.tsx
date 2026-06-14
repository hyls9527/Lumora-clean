1|import * as React from "react"
2|import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
3|
4|import { cn } from "src/lib/utils"
5|import { Button } from "src/components/ui/button"
6|import { XIcon } from "lucide-react"
7|
8|function Dialog({ ...props }: DialogPrimitive.Root.Props) {
9|  return <DialogPrimitive.Root data-slot="dialog" {...props} />
10|}
11|
12|function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
13|  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
14|}
15|
16|function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
17|  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
18|}
19|
20|function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
21|  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
22|}
23|
24|function DialogOverlay({
25|  className,
26|  ...props
27|}: DialogPrimitive.Backdrop.Props) {
28|  return (
29|    <DialogPrimitive.Backdrop
30|      data-slot="dialog-overlay"
31|      className={cn(
32|        "fixed inset-0 isolate z-50 bg-black/10 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
33|        className
34|      )}
35|      {...props}
36|    />
37|  )
38|}
39|
40|function DialogContent({
41|  className,
42|  children,
43|  showCloseButton = true,
44|  ...props
45|}: DialogPrimitive.Popup.Props & {
46|  showCloseButton?: boolean
47|}) {
48|  return (
49|    <DialogPortal>
50|      <DialogOverlay />
51|      <DialogPrimitive.Popup
52|        data-slot="dialog-content"
53|        className={cn(
54|          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-200 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
55|          className
56|        )}
57|        {...props}
58|      >
59|        {children}
60|        {showCloseButton && (
61|          <DialogPrimitive.Close
62|            data-slot="dialog-close"
63|            render={
64|              <Button
65|                variant="ghost"
66|                className="absolute top-2 right-2"
67|                size="icon-sm"
68|              />
69|            }
70|          >
71|            <XIcon
72|            />
73|            <span className="sr-only">Close</span>
74|          </DialogPrimitive.Close>
75|        )}
76|      </DialogPrimitive.Popup>
77|    </DialogPortal>
78|  )
79|}
80|
81|function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
82|  return (
83|    <div
84|      data-slot="dialog-header"
85|      className={cn("flex flex-col gap-2", className)}
86|      {...props}
87|    />
88|  )
89|}
90|
91|function DialogFooter({
92|  className,
93|  showCloseButton = false,
94|  children,
95|  ...props
96|}: React.ComponentProps<"div"> & {
97|  showCloseButton?: boolean
98|}) {
99|  return (
100|    <div
101|      data-slot="dialog-footer"
102|      className={cn(
103|        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
104|        className
105|      )}
106|      {...props}
107|    >
108|      {children}
109|      {showCloseButton && (
110|        <DialogPrimitive.Close render={<Button variant="outline" />}>
111|          Close
112|        </DialogPrimitive.Close>
113|      )}
114|    </div>
115|  )
116|}
117|
118|function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
119|  return (
120|    <DialogPrimitive.Title
121|      data-slot="dialog-title"
122|      className={cn(
123|        "text-base leading-none font-medium",
124|        className
125|      )}
126|      {...props}
127|    />
128|  )
129|}
130|
131|function DialogDescription({
132|  className,
133|  ...props
134|}: DialogPrimitive.Description.Props) {
135|  return (
136|    <DialogPrimitive.Description
137|      data-slot="dialog-description"
138|      className={cn(
139|        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
140|        className
141|      )}
142|      {...props}
143|    />
144|  )
145|}
146|
147|export {
148|  Dialog,
149|  DialogClose,
150|  DialogContent,
151|  DialogDescription,
152|  DialogFooter,
153|  DialogHeader,
154|  DialogOverlay,
155|  DialogPortal,
156|  DialogTitle,
157|  DialogTrigger,
158|}
165|