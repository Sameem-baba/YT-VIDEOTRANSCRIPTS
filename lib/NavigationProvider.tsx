'use client'

import { createContext, useState } from "react";

interface NavigationContextType {
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
    closeMobileNav: () => void;
}

export const NavigationContext = createContext<NavigationContextType>({
    isMobileNavOpen: false,
    setIsMobileNavOpen: () => { },
    closeMobileNav: () => { },
});

export function NavigationProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [ isMobileNavOpen, setIsMobileNavOpen ] = useState(false);

    function closeMobileNav() {
        setIsMobileNavOpen(false);
    }
    return (
        <NavigationContext
            value={ {
                isMobileNavOpen,
                setIsMobileNavOpen,
                closeMobileNav,
            } }
        >
            { children }
        </NavigationContext>
    )
}