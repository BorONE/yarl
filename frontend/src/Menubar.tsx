import { Input } from './components/ui/input';

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Button } from './components/ui/button';
import { DialogClose } from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';

import Cookies from 'universal-cookie';

import * as client from './client'

import { Moon, Sun } from "lucide-react"

import { useTheme } from "./ThemeProvider"
import { Textarea } from './components/ui/textarea';

import { toast } from "sonner"

export enum DialogType {
	None = "",
	OpenGraph = "open",
	SaveGraph = "save",
	ExportNodes = "export",
	ImportNodes = "import",
}

type Ctx = {
	graphPathRef: React.Ref<HTMLInputElement>,
	loadGraph: () => void,
	saveGraph: () => void,
	anySelected: () => boolean,
	exportNodes: () => string,
	verifyImport: (data: string) => boolean,
	importNodes: (data: string) => void,
	importRef: React.RefObject<HTMLTextAreaElement | null>,
}

export function SharedDialogContent(dialog: DialogType, ctx : Partial<Ctx>) {
	switch (dialog) {
	case DialogType.OpenGraph: {
		const graphPathRef = ctx.graphPathRef as React.Ref<HTMLInputElement>
		const loadGraph = ctx.loadGraph as () => void
		return (
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Open graph</DialogTitle>
					<DialogDescription></DialogDescription>
				</DialogHeader>
				<div className="flex gap-2">
					<Input
						ref={graphPathRef}
						placeholder='yarl.proto.txt'
						defaultValue={new Cookies().get('graph-path')}
						onChange={(change) => new Cookies().set('graph-path', change.currentTarget.value)}
					/>
					<DialogClose asChild>
						<Button type="button" variant="default" onClick={loadGraph}>
							Open
						</Button>
					</DialogClose>
				</div>
			</DialogContent>
		)
	}
	case DialogType.SaveGraph: {
		const graphPathRef = ctx.graphPathRef as React.Ref<HTMLInputElement>
		const saveGraph = ctx.saveGraph as () => void
		return (
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save graph as</DialogTitle>
					<DialogDescription></DialogDescription>
				</DialogHeader>
				<div className="flex gap-2">
					<Input
						ref={graphPathRef}
						placeholder='yarl.proto.txt'
						defaultValue={new Cookies().get('graph-path')}
						onChange={(change) => new Cookies().set('graph-path', change.currentTarget.value)}
					/>
					<DialogClose asChild>
						<Button type="button" variant="default" onClick={saveGraph}>
							Save
						</Button>
					</DialogClose>
				</div>
			</DialogContent>
		)
	}
	case DialogType.ExportNodes:
		const exportNodes = ctx.exportNodes as () => string
		const anySelected = ctx.anySelected as () => boolean
		const value = exportNodes()
		return (
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{anySelected() ? "Export selected nodes" : "Export full graph"}
					</DialogTitle>
					<DialogDescription>Copy this string</DialogDescription>
				</DialogHeader>
				<Textarea readOnly value={value} wrap='off' />
				<div className="flex gap-2">
					<Button type="button" variant="default" onClick={() => {
						navigator.clipboard.writeText(value)
						toast("Export data is copied")
					}}>
						Copy
					</Button>
					<DialogClose asChild>
						<Button type="button" variant="secondary">Close</Button>
					</DialogClose>
				</div>
			</DialogContent>
		)
	case DialogType.ImportNodes:
		const importRef = ctx.importRef as React.RefObject<HTMLTextAreaElement | null>
		const verifyImport = ctx.verifyImport as (data: string) => boolean
		const importNodes = ctx.importNodes as (data: string) => void
		navigator.clipboard.readText().then(value => {
			if (importRef.current) {
				importRef.current.value = verifyImport(value) ? value : ""
			}
		})
		return (
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Import</DialogTitle>
					<DialogDescription>Paste string</DialogDescription>
				</DialogHeader>
				<Textarea placeholder='Paste your string here...' ref={importRef} wrap='off' />
				<div className="flex gap-2">
					<DialogClose asChild>
						<Button type="button" variant="default" onClick={() => {
							importNodes(importRef.current ? importRef.current.value : "")
						}}>
							Import
						</Button>
					</DialogClose>
				</div>
			</DialogContent>
		)
	}
}

export default ({
	anySelected,
	addNewNode,
	copyNodes,
	pasteNodes,
	exportNodes,
	verifyImport,
	importNodes,
} : {
	anySelected: () => boolean,
	addNewNode: () => void,
	copyNodes: () => void,
	pasteNodes: () => void,
	exportNodes: () => string,
	verifyImport: (data: string) => boolean,
	importNodes: (data: string) => void,
}) => {
	const [selectedDialog, selectDialog] = useState(DialogType.None)

	const importRef = useRef<HTMLTextAreaElement>(null)

	var graphPathRef = useRef<HTMLInputElement>(null)
	const newGraph = () => {
		if (graphPathRef.current != null) {
			graphPathRef.current.value = ""
		}
		new Cookies().set('graph-path', "")
		client.graph.new({})
	}
	const saveGraph = () => { client.graph.save({Path: graphPathRef.current?.value}) }
	const loadGraph = () => { client.graph.load({Path: graphPathRef.current?.value}) }

	const nodeKbd = (char: string) => (
		<Kbd style={{marginLeft: 'auto', marginRight: 0}}>Ctrl+Alt+{char}</Kbd>
	)

	const { setTheme } = useTheme()

	return (
		<Dialog>
			<Menubar style={{ padding: 0 }}>
				<MenubarMenu>
					<MenubarTrigger>Graph</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onSelect={newGraph}> New </MenubarItem>
						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog(DialogType.OpenGraph)}> Open </MenubarItem>
						</DialogTrigger>
						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog(DialogType.SaveGraph)}> Save as </MenubarItem>
						</DialogTrigger>

						<MenubarSeparator/>

						<MenubarItem onSelect={() => client.graph.scheduleAll({})}>Schedule</MenubarItem>
					</MenubarContent>
				</MenubarMenu>

				<MenubarMenu>
					<MenubarTrigger>Node</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onSelect={addNewNode}>
							New {nodeKbd('N')}
						</MenubarItem>

						<MenubarSeparator/>

						<MenubarItem onSelect={copyNodes} disabled={!anySelected()}>
							Copy {nodeKbd('C')}
						</MenubarItem>
						<MenubarItem onSelect={pasteNodes}>
							Paste {nodeKbd('V')}
						</MenubarItem>

						<MenubarSeparator/>

						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog(DialogType.ExportNodes)}>
								{anySelected() ? "Export Selected" : "Export"}
							</MenubarItem>
						</DialogTrigger>
						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog(DialogType.ImportNodes)}>
								Import
							</MenubarItem>
						</DialogTrigger>
					</MenubarContent>
				</MenubarMenu>

				<MenubarMenu>
					<MenubarTrigger>
						<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
						<span className="sr-only">Toggle theme</span>
					</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onSelect={() => setTheme("light")}>
							Light
						</MenubarItem>
						<MenubarItem onSelect={() => setTheme("dark")}>
							Dark
						</MenubarItem>
						<MenubarItem onSelect={() => setTheme("system")}>
							System
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>

			{SharedDialogContent(selectedDialog, {
				graphPathRef,
				loadGraph,
				saveGraph,
				anySelected,
				exportNodes,
				importRef,
				verifyImport,
				importNodes,
			})}
		</Dialog>
	)
}