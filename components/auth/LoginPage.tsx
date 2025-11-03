import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomePage from '../common/HomePage';
import LoginModal from './LoginModal';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    // The modal is open by default when this component renders
    const [isModalOpen, setIsModalOpen] = useState(true);

    const handleClose = () => {
        setIsModalOpen(false);
        // Navigate back to the homepage when the modal is closed
        navigate('/');
    };

    return (
        <>
            {/* Render the HomePage as the background */}
            <HomePage />
            {/* Render the LoginModal on top */}
            <LoginModal isOpen={isModalOpen} onClose={handleClose} />
        </>
    );
};

export default LoginPage;