export interface Paragraph {
	startIndex: number,
	endIndex: number,
	contributors: {
		[author: string]: number
	}
	mainContributor: string
}


export interface CohDiagramData {
	nodes: Node[],
	distances: NodeDistance[],
	connections: NodeConnection[]
}

export interface Node { 
	id: string, 
	name: string, 
	color: string 
}

export interface NodeDistance { 
	source: string, 
	target: string, 
	dist: number 
}

export interface NodeConnection { 
	source: string, 
	target: string, 
	intensity: number 
}
