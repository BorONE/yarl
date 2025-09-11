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
import { Button } from './components/ui/button';
import { DialogClose } from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';

import Cookies from 'universal-cookie';

import * as client from './client'

export default ({ addNewNode } : { addNewNode: (event: Event) => void }) => {
	const [selectedDialog, selectDialog] = useState("")

	const getDialogContent = () => {
		switch (selectedDialog) {
		case "open":
			return (
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Open graph</DialogTitle>
						<DialogDescription></DialogDescription>
					</DialogHeader>
					<div style={{ display: "flex" }}>
						<Input
							ref={graphPathRef}
							placeholder='yarl.proto.txt'
							defaultValue={new Cookies().get('graph-path')}
							onChange={(change) => new Cookies().set('graph-path', change.currentTarget.value)}
						/>
						<DialogClose asChild>
							<Button type="button" variant="secondary" onClick={loadGraph}>
								Open
							</Button>
						</DialogClose>
					</div>
				</DialogContent>
			)
		case "save":
			return (
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save graph as</DialogTitle>
						<DialogDescription></DialogDescription>
					</DialogHeader>
					<div style={{ display: "flex" }}>
						<Input
							ref={graphPathRef}
							placeholder='yarl.proto.txt'
							defaultValue={new Cookies().get('graph-path')}
							onChange={(change) => new Cookies().set('graph-path', change.currentTarget.value)}
						/>
						<DialogClose asChild>
							<Button type="button" variant="secondary" onClick={saveGraph}>
								Save
							</Button>
						</DialogClose>
					</div>
				</DialogContent>
			)
		}
	}

	var graphPathRef = useRef<HTMLInputElement>(null)
	const newGraph = () => {
		if (graphPathRef.current != null) {
			graphPathRef.current.value = ""
		}
		new Cookies().set('graph-path', "")
		client.graph.new({})
	}
	const saveGraph = () => client.graph.save({Path: graphPathRef.current?.value})
	const loadGraph = () => client.graph.load({Path: graphPathRef.current?.value})

	return (
		<Dialog>
			<Menubar style={{ padding: 0 }}>
				<MenubarMenu>
					<MenubarTrigger>Graph</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onSelect={newGraph}> New </MenubarItem>
						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog("open")}> Open </MenubarItem>
						</DialogTrigger>
						<DialogTrigger asChild>
							<MenubarItem onSelect={() => selectDialog("save")}> Save as </MenubarItem>
						</DialogTrigger>

						<MenubarSeparator/>

						<MenubarItem onSelect={() => client.graph.scheduleAll({})}>Schedule</MenubarItem>
					</MenubarContent>
				</MenubarMenu>

				<MenubarMenu>
					<MenubarTrigger>Node</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onSelect={addNewNode}>New</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>
			{getDialogContent()}
		</Dialog>
	)
}