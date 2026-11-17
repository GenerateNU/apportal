// The app's one spacing scale: every page, section and list takes its gaps from here.
export const PAGE_X = 'px-5 sm:px-10 lg:px-16 xl:px-24'
export const PAGE_TOP = 'pt-8 sm:pt-12'
export const PAGE_L = 'pl-5 sm:pl-10 lg:pl-16 xl:pl-24'
export const PAGE_R = 'pr-5 sm:pr-10 lg:pr-16 xl:pr-24'
// Pulls a full-width bar out to the page edges; pair with PAGE_X to keep its content aligned.
export const PAGE_BLEED = '-mx-5 sm:-mx-10 lg:-mx-16 xl:-mx-24'
export const PAGE_GAP = 'gap-8'
export const PAGE_SHELL = `flex w-full flex-col ${PAGE_GAP} pb-12 ${PAGE_X} ${PAGE_TOP}`
export const SECTION = 'flex flex-col gap-3'
export const STACK = 'flex flex-col gap-4'
export const CARD_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4'
